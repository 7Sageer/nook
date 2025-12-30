package rag

import (
	"fmt"
	"os"
	"path/filepath"

	"notion-lite/internal/document"
	"notion-lite/internal/opengraph"
)

// Service RAG 服务统一入口
type Service struct {
	dataPath   string
	store      *VectorStore
	indexer    *Indexer
	searcher   *Searcher
	embedder   EmbeddingClient
	docRepo    *document.Repository
	docStorage *document.Storage
}

// NewService 创建 RAG 服务
func NewService(dataPath string, docRepo *document.Repository, docStorage *document.Storage) *Service {
	return &Service{
		dataPath:   dataPath,
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
	config, err := LoadConfig(s.dataPath)
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
	dbPath := filepath.Join(s.dataPath, "vectors.db")
	store, err := NewVectorStore(dbPath, embedder.Dimension())
	if err != nil {
		return err
	}
	s.store = store

	// 创建索引器和搜索器
	s.indexer = NewIndexer(store, embedder, s.docRepo, s.docStorage)
	s.searcher = NewSearcher(store, embedder, s.docRepo)

	return nil
}

// IndexDocument 索引单个文档
func (s *Service) IndexDocument(docID string) error {
	if err := s.init(); err != nil {
		return err
	}
	return s.indexer.IndexDocument(docID)
}

// Search 语义搜索（Chunk 级别）
func (s *Service) Search(query string, limit int) ([]SemanticSearchResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.searcher.Search(query, limit)
}

// SearchDocuments 文档级语义搜索（聚合 chunks）
func (s *Service) SearchDocuments(query string, limit int) ([]DocumentSearchResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.searcher.SearchDocuments(query, limit)
}

// ReindexAll 重建所有文档索引
func (s *Service) ReindexAll() (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}
	return s.indexer.ReindexAll()
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
	if s.store == nil {
		dbPath := filepath.Join(s.dataPath, "vectors.db")
		store, err := NewVectorStore(dbPath, 768) // 默认维度
		if err != nil {
			return 0, nil // 数据库不存在，返回 0
		}
		s.store = store
	}
	return s.store.GetIndexedDocCount()
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
		s.store.Close()
	}

	// 重置所有组件
	s.store = nil
	s.indexer = nil
	s.searcher = nil
	s.embedder = nil

	// 加载新配置，检查维度是否变化
	config, err := LoadConfig(s.dataPath)
	if err != nil {
		return err
	}

	newEmbedder, err := NewEmbeddingClient(config)
	if err != nil {
		return err
	}
	newDimension := newEmbedder.Dimension()

	// 如果维度变化，删除旧的向量数据库
	if oldDimension > 0 && oldDimension != newDimension {
		dbPath := filepath.Join(s.dataPath, "vectors.db")
		os.Remove(dbPath) // 忽略错误，可能文件不存在
	}

	// 重新初始化
	s.embedder = newEmbedder

	dbPath := filepath.Join(s.dataPath, "vectors.db")
	store, err := NewVectorStore(dbPath, newDimension)
	if err != nil {
		return err
	}
	s.store = store

	s.indexer = NewIndexer(store, s.embedder, s.docRepo, s.docStorage)
	s.searcher = NewSearcher(store, s.embedder, s.docRepo)

	return nil
}

// IndexBookmarkContent 索引书签网页内容
func (s *Service) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	fmt.Printf("[RAG] IndexBookmarkContent called: url=%s, docID=%s, blockID=%s\n", url, sourceDocID, blockID)

	if err := s.init(); err != nil {
		fmt.Printf("[RAG] init failed: %v\n", err)
		return err
	}

	// 1. 抓取网页内容
	fmt.Printf("[RAG] Fetching content from URL...\n")
	content, err := opengraph.FetchContent(url)
	if err != nil {
		fmt.Printf("[RAG] FetchContent failed: %v\n", err)
		return fmt.Errorf("failed to fetch content: %w", err)
	}
	fmt.Printf("[RAG] FetchContent succeeded: title=%s, content_len=%d\n", content.Title, len(content.TextContent))

	// 2. 检查内容是否为空
	if content.TextContent == "" {
		fmt.Printf("[RAG] No content extracted from URL\n")
		return fmt.Errorf("no content extracted from URL")
	}

	// 3. 生成唯一的块 ID
	bookmarkBlockID := fmt.Sprintf("%s_%s_bookmark", sourceDocID, blockID)
	fmt.Printf("[RAG] Generated bookmark block ID: %s\n", bookmarkBlockID)

	// 4. 计算内容哈希
	contentHash := HashContent(content.TextContent)

	// 5. 生成 embedding
	fmt.Printf("[RAG] Generating embedding...\n")
	embedding, err := s.embedder.Embed(content.TextContent)
	if err != nil {
		fmt.Printf("[RAG] Embed failed: %v\n", err)
		return fmt.Errorf("failed to generate embedding: %w", err)
	}
	fmt.Printf("[RAG] Embedding generated: dimension=%d\n", len(embedding))

	// 6. 构建上下文信息
	headingContext := content.Title
	if content.SiteName != "" {
		headingContext = fmt.Sprintf("%s - %s", content.Title, content.SiteName)
	}

	// 7. 存入向量数据库
	fmt.Printf("[RAG] Upserting to vector store...\n")
	err = s.store.Upsert(&BlockVector{
		ID:             bookmarkBlockID,
		DocID:          sourceDocID,
		Content:        content.TextContent,
		ContentHash:    contentHash,
		BlockType:      "bookmark",
		HeadingContext: headingContext,
		Embedding:      embedding,
	})
	if err != nil {
		fmt.Printf("[RAG] Upsert failed: %v\n", err)
		return err
	}

	fmt.Printf("[RAG] IndexBookmarkContent completed successfully!\n")
	return nil
}
