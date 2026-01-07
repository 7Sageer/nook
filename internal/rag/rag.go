package rag

import (
	"context"
	"encoding/json"
	"fmt"
	"notion-lite/internal/document"
	"notion-lite/internal/utils"
	"os"
	"strings"
)

// Service RAG 服务统一入口
type Service struct {
	ctx             context.Context
	paths           *utils.PathBuilder
	store           *VectorStore
	indexer         *Indexer
	searcher        *Searcher
	externalIndexer *ExternalIndexer
	embedder        EmbeddingClient
	docRepo         *document.Repository
	docStorage      *document.Storage
}

// NewService 创建 RAG 服务
func NewService(paths *utils.PathBuilder, docRepo *document.Repository, docStorage *document.Storage) *Service {
	return &Service{
		paths:      paths,
		docRepo:    docRepo,
		docStorage: docStorage,
	}
}

// init 初始化内部组件（延迟初始化）
func (s *Service) init() error {
	if s.embedder != nil {
		return nil // 已初始化
	}

	// 加载配置
	config, err := LoadConfig(s.paths)
	if err != nil {
		return err
	}

	// 创建 Embedding 客户端
	embedder, err := NewEmbeddingClient(config)
	if err != nil {
		return err
	}
	s.embedder = embedder

	// 创建向量存储
	dbPath := s.paths.RAGDatabase()
	store, err := NewVectorStore(dbPath, embedder.Dimension())
	if err != nil {
		return err
	}
	s.store = store

	// 创建索引器和搜索器
	s.indexer = NewIndexer(store, embedder, s.docRepo, s.docStorage, s.paths)
	s.searcher = NewSearcher(store, embedder, s.docRepo)
	s.externalIndexer = NewExternalIndexer(store, embedder, s.docRepo, s.docStorage, s.indexer, s.paths)

	return nil
}

// Warmup 预热初始化（只加载组件，不做实际搜索）
// 用于在应用空闲时提前初始化，避免首次使用时的冷启动延迟
func (s *Service) Warmup() error {
	return s.init()
}

// IndexDocument 索引单个文档
func (s *Service) IndexDocument(docID string) error {
	if err := s.init(); err != nil {
		return err
	}
	return s.indexer.IndexDocument(docID)
}

// SearchDocuments 文档级语义搜索（聚合 chunks）
func (s *Service) SearchDocuments(query string, limit int, filter *SearchFilter) ([]DocumentSearchResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.searcher.SearchDocuments(query, limit, filter)
}

// SearchChunks 块级语义搜索
func (s *Service) SearchChunks(query string, limit int, filter *SearchFilter) ([]ChunkMatch, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.searcher.SearchChunks(query, limit, filter)
}

// ReindexAll 重建所有文档索引
func (s *Service) ReindexAll() (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}
	return s.indexer.ReindexAll()
}

// SetContext 设置 Wails 上下文（用于发送事件）
func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// ReindexAllWithProgress 重建所有文档索引（带进度回调）
func (s *Service) ReindexAllWithProgress(onProgress func(current, total int)) (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}
	return s.indexer.ReindexAllWithCallback(onProgress)
}

// DeleteDocument 删除文档的所有向量索引
func (s *Service) DeleteDocument(docID string) error {
	if err := s.init(); err != nil {
		return err
	}
	return s.store.DeleteByDocID(docID)
}

// GetIndexedCount 获取已索引的文档数量
func (s *Service) GetIndexedCount() (int, error) {
	if err := s.init(); err != nil {
		return 0, nil // 初始化失败，返回 0
	}
	return s.store.GetIndexedDocCount()
}

// GetIndexedStats 获取索引统计信息 (文档数, 书签数, 嵌入文件数, 文件夹数)
func (s *Service) GetIndexedStats() (int, int, int, int, error) {
	if err := s.init(); err != nil {
		return 0, 0, 0, 0, nil // 初始化失败，返回 0
	}
	return s.store.GetIndexedStats()
}

// Reinitialize 重新初始化（配置变更后调用）
// 如果新模型的维度与旧模型不同，会自动删除向量数据库
func (s *Service) Reinitialize() error {
	// 获取旧的维度
	oldDimension := 0
	if s.embedder != nil {
		oldDimension = s.embedder.Dimension()
	}

	// 关闭旧的存储
	if s.store != nil {
		if err := s.store.Close(); err != nil {
			fmt.Printf("⚠️ [RAG] Failed to close store: %v\n", err)
		}
	}

	// 重置所有组件
	s.store = nil
	s.indexer = nil
	s.searcher = nil
	s.embedder = nil

	// 加载新配置，检查维度是否变化
	config, err := LoadConfig(s.paths)
	if err != nil {
		return err
	}

	newEmbedder, err := NewEmbeddingClient(config)
	if err != nil {
		return err
	}
	newDimension := newEmbedder.Dimension()

	// 检查维度是否变化
	dimensionChanged := oldDimension > 0 && oldDimension != newDimension

	// 如果维度变化，删除旧的向量数据库
	if dimensionChanged {
		dbPath := s.paths.RAGDatabase()
		fmt.Printf("🔄 [RAG] Dimension changed (%d → %d), removing old database...\n", oldDimension, newDimension)
		if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
			fmt.Printf("⚠️ [RAG] Failed to remove old database: %v\n", err)
		}
	}

	// 重新初始化
	s.embedder = newEmbedder

	dbPath := s.paths.RAGDatabase()
	store, err := NewVectorStore(dbPath, newDimension)
	if err != nil {
		return err
	}
	s.store = store

	s.indexer = NewIndexer(store, s.embedder, s.docRepo, s.docStorage, s.paths)
	s.searcher = NewSearcher(store, s.embedder, s.docRepo)
	s.externalIndexer = NewExternalIndexer(store, s.embedder, s.docRepo, s.docStorage, s.indexer, s.paths)

	// 如果维度变化，自动触发全量重建索引（包括 bookmark 和 file 块）
	if dimensionChanged {
		go func() {
			fmt.Println("🔄 [RAG] Starting automatic reindex due to dimension change...")
			if count, err := s.ReindexAll(); err != nil {
				fmt.Printf("⚠️ [RAG] ReindexAll failed: %v\n", err)
			} else {
				fmt.Printf("✅ [RAG] Reindexed %d documents\n", count)
			}
			if extCount, err := s.ReindexExternalContent(); err != nil {
				fmt.Printf("⚠️ [RAG] ReindexExternalContent failed: %v\n", err)
			} else {
				fmt.Printf("✅ [RAG] Reindexed %d external blocks (bookmarks + files)\n", extCount)
			}
		}()
	}

	return nil
}

// ReindexExternalContent 重新索引所有 bookmark 和 file 块
func (s *Service) ReindexExternalContent() (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}
	return s.externalIndexer.ReindexAll()
}

// ReindexExternalContentWithProgress 重新索引所有 bookmark 和 file 块（带进度回调）
func (s *Service) ReindexExternalContentWithProgress(onProgress func(current, total int)) (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}
	return s.externalIndexer.ReindexAllWithProgress(onProgress)
}

// IndexBookmarkContent 索引书签网页内容
func (s *Service) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	if err := s.init(); err != nil {
		return err
	}
	return s.externalIndexer.IndexBookmarkContent(url, sourceDocID, blockID)
}

// IndexFileContent 索引文件内容
func (s *Service) IndexFileContent(filePath, sourceDocID, blockID, fileName string) error {
	if err := s.init(); err != nil {
		return err
	}
	return s.externalIndexer.IndexFileContent(filePath, sourceDocID, blockID, fileName)
}

// GetExternalBlockContent 获取外部块的完整提取内容
func (s *Service) GetExternalBlockContent(docID, blockID string) (*ExternalBlockContent, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.store.GetExternalContent(docID, blockID)
}

// IndexFolderContent 索引文件夹内容
func (s *Service) IndexFolderContent(folderPath, sourceDocID, blockID string) (*FolderIndexResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.externalIndexer.IndexFolderContent(folderPath, sourceDocID, blockID, 10)
}

// SearchSimilarDocuments 搜索与指定文档相似的文档（用于 tag 推荐）
func (s *Service) SearchSimilarDocuments(docID string, limit int) ([]SimilarDocResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}

	// 获取文档内容
	content, err := s.docStorage.Load(docID)
	if err != nil {
		return nil, err
	}

	// 提取纯文本作为查询（最多 500 字）
	query := extractPlainText([]byte(content), 500)
	if query == "" {
		return nil, nil
	}

	// 搜索相似文档（排除当前文档）
	filter := &SearchFilter{ExcludeDocID: docID}
	results, err := s.searcher.SearchDocuments(query, limit, filter)
	if err != nil {
		return nil, err
	}

	// 转换结果
	similar := make([]SimilarDocResult, len(results))
	for i, r := range results {
		similar[i] = SimilarDocResult{DocID: r.DocID}
	}
	return similar, nil
}

// SimilarDocResult 相似文档结果
type SimilarDocResult struct {
	DocID string `json:"docId"`
}

// extractPlainText 从文档内容提取纯文本（用于语义搜索查询）
func extractPlainText(content []byte, maxChars int) string {
	var blocks []interface{}
	if err := json.Unmarshal(content, &blocks); err != nil {
		return ""
	}

	var texts []string
	extractTextsFromBlocks(blocks, &texts)

	result := strings.Join(texts, " ")
	if maxChars > 0 && len(result) > maxChars {
		result = result[:maxChars]
	}
	return strings.TrimSpace(result)
}

// extractTextsFromBlocks 递归提取所有块的文本
func extractTextsFromBlocks(blocks []interface{}, texts *[]string) {
	for _, block := range blocks {
		blockMap, ok := block.(map[string]interface{})
		if !ok {
			continue
		}

		// 提取当前块的文本内容
		if content, ok := blockMap["content"].([]interface{}); ok {
			text := extractTextFromContentItems(content)
			if text != "" {
				*texts = append(*texts, text)
			}
		}

		// 递归处理子块
		if children, ok := blockMap["children"].([]interface{}); ok {
			extractTextsFromBlocks(children, texts)
		}
	}
}

// extractTextFromContentItems 从 content 数组提取文本
func extractTextFromContentItems(content []interface{}) string {
	var parts []string
	for _, item := range content {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemMap["type"] == "text" {
			if text, ok := itemMap["text"].(string); ok {
				parts = append(parts, text)
			}
		}
		if itemMap["type"] == "link" {
			if linkContent, ok := itemMap["content"].([]interface{}); ok {
				parts = append(parts, extractTextFromContentItems(linkContent))
			}
		}
	}
	return strings.Join(parts, "")
}
