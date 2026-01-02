package rag

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"notion-lite/internal/document"
	"notion-lite/internal/fileextract"
	"notion-lite/internal/opengraph"
)

// Service RAG 服务统一入口
type Service struct {
	ctx        context.Context
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
	s.indexer = NewIndexer(store, embedder, s.docRepo, s.docStorage, s.dataPath)
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

// FindRelatedDocuments 查找相关文档（基于内容片段的 chunk → doc 推荐）
func (s *Service) FindRelatedDocuments(content string, limit int, excludeDocID string) ([]DocumentSearchResult, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.searcher.FindRelatedDocuments(content, limit, excludeDocID)
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

// GetIndexedStats 获取索引统计信息 (文档数, 书签数, 嵌入文件数)
func (s *Service) GetIndexedStats() (int, int, int, error) {
	if err := s.init(); err != nil {
		return 0, 0, 0, nil // 初始化失败，返回 0
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
	config, err := LoadConfig(s.dataPath)
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
		dbPath := filepath.Join(s.dataPath, "vectors.db")
		fmt.Printf("🔄 [RAG] Dimension changed (%d → %d), removing old database...\n", oldDimension, newDimension)
		if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
			fmt.Printf("⚠️ [RAG] Failed to remove old database: %v\n", err)
		}
	}

	// 重新初始化
	s.embedder = newEmbedder

	dbPath := filepath.Join(s.dataPath, "vectors.db")
	store, err := NewVectorStore(dbPath, newDimension)
	if err != nil {
		return err
	}
	s.store = store

	s.indexer = NewIndexer(store, s.embedder, s.docRepo, s.docStorage, s.dataPath)
	s.searcher = NewSearcher(store, s.embedder, s.docRepo)

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
// 遍历所有文档，提取 bookmark/file 块信息，然后重新抓取和索引
func (s *Service) ReindexExternalContent() (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}

	// 获取所有文档
	index, err := s.docRepo.GetAll()
	if err != nil {
		return 0, fmt.Errorf("failed to get documents: %w", err)
	}

	totalCount := 0
	for _, doc := range index.Documents {
		// 加载文档内容
		content, err := s.docStorage.Load(doc.ID)
		if err != nil {
			fmt.Printf("⚠️ [RAG] Failed to load document %s: %v\n", doc.ID, err)
			continue
		}

		// 提取外部块信息
		externalIDs := ExtractExternalBlockIDs([]byte(content))

		// 重新索引 bookmark 块
		for _, bookmark := range externalIDs.BookmarkBlocks {
			if bookmark.URL == "" {
				continue
			}
			if err := s.IndexBookmarkContent(bookmark.URL, doc.ID, bookmark.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex bookmark %s: %v\n", bookmark.BlockID, err)
			} else {
				totalCount++
				fmt.Printf("✅ [RAG] Reindexed bookmark: %s\n", bookmark.URL)
			}
		}

		// 重新索引 file 块
		for _, file := range externalIDs.FileBlocks {
			if file.FilePath == "" {
				continue
			}
			if err := s.IndexFileContent(file.FilePath, doc.ID, file.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex file %s: %v\n", file.BlockID, err)
			} else {
				totalCount++
				fmt.Printf("✅ [RAG] Reindexed file: %s\n", file.FilePath)
			}
		}
	}

	return totalCount, nil
}

// ReindexExternalContentWithProgress 重新索引所有 bookmark 和 file 块（带进度回调）
func (s *Service) ReindexExternalContentWithProgress(onProgress func(current, total int)) (int, error) {
	if err := s.init(); err != nil {
		return 0, err
	}

	// 获取所有文档并计算外部块总数
	index, err := s.docRepo.GetAll()
	if err != nil {
		return 0, fmt.Errorf("failed to get documents: %w", err)
	}

	// 先统计总数
	var allExternalBlocks []struct {
		docID    string
		bookmark *BookmarkBlockInfo
		file     *FileBlockInfo
	}

	for _, doc := range index.Documents {
		content, err := s.docStorage.Load(doc.ID)
		if err != nil {
			continue
		}
		externalIDs := ExtractExternalBlockIDs([]byte(content))
		for i := range externalIDs.BookmarkBlocks {
			if externalIDs.BookmarkBlocks[i].URL != "" {
				allExternalBlocks = append(allExternalBlocks, struct {
					docID    string
					bookmark *BookmarkBlockInfo
					file     *FileBlockInfo
				}{docID: doc.ID, bookmark: &externalIDs.BookmarkBlocks[i]})
			}
		}
		for i := range externalIDs.FileBlocks {
			if externalIDs.FileBlocks[i].FilePath != "" {
				allExternalBlocks = append(allExternalBlocks, struct {
					docID    string
					bookmark *BookmarkBlockInfo
					file     *FileBlockInfo
				}{docID: doc.ID, file: &externalIDs.FileBlocks[i]})
			}
		}
	}

	total := len(allExternalBlocks)
	if total == 0 {
		return 0, nil
	}

	successCount := 0
	for i, block := range allExternalBlocks {
		// 发送进度
		if onProgress != nil {
			onProgress(i+1, total)
		}

		if block.bookmark != nil {
			if err := s.IndexBookmarkContent(block.bookmark.URL, block.docID, block.bookmark.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex bookmark %s: %v\n", block.bookmark.BlockID, err)
			} else {
				successCount++
				fmt.Printf("✅ [RAG] Reindexed bookmark: %s\n", block.bookmark.URL)
			}
		} else if block.file != nil {
			if err := s.IndexFileContent(block.file.FilePath, block.docID, block.file.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex file %s: %v\n", block.file.BlockID, err)
			} else {
				successCount++
				fmt.Printf("✅ [RAG] Reindexed file: %s\n", block.file.FilePath)
			}
		}
	}

	return successCount, nil
}

// IndexBookmarkContent 索引书签网页内容（分块存储）
func (s *Service) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	if err := s.init(); err != nil {
		return err
	}

	// 1. 抓取网页内容
	content, err := opengraph.FetchContent(url)
	if err != nil {
		return fmt.Errorf("failed to fetch content: %w", err)
	}

	// 2. 检查内容是否为空
	if content.TextContent == "" {
		return fmt.Errorf("no content extracted from URL")
	}

	// 3. 构建上下文信息
	headingContext := content.Title
	if content.SiteName != "" {
		headingContext = fmt.Sprintf("%s - %s", content.Title, content.SiteName)
	}

	// 4. 生成基础 ID
	baseID := fmt.Sprintf("%s_%s_bookmark", sourceDocID, blockID)

	// 5. 删除该 bookmark block 的旧 chunks（修复重新索引时的主键冲突）
	if err := s.store.DeleteBlocksByPrefix(baseID); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete old bookmark chunks for %s: %v\n", baseID, err)
	}

	// 5.1 保存完整提取内容（供 MCP 工具读取）
	if err := s.store.SaveExternalContent(&ExternalBlockContent{
		ID:          fmt.Sprintf("%s_%s", sourceDocID, blockID),
		DocID:       sourceDocID,
		BlockID:     blockID,
		BlockType:   "bookmark",
		URL:         url,
		Title:       content.Title,
		RawContent:  content.TextContent,
		ExtractedAt: time.Now().Unix(),
	}); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to save bookmark content for %s: %v\n", baseID, err)
	}

	// 6. 对内容进行分块
	chunks := ChunkTextContent(content.TextContent, headingContext, baseID, s.indexer.chunkConfig)

	// 如果分块结果为空，创建一个单独的块
	if len(chunks) == 0 {
		chunks = []ExtractedBlock{{
			ID:             baseID,
			Type:           "bookmark",
			Content:        content.TextContent,
			HeadingContext: headingContext,
		}}
	}

	// 调试输出
	if debugChunks {
		fmt.Printf("\n🔖 [RAG] Indexing bookmark: %s\n", url)
		fmt.Printf("   Title: %s\n", content.Title)
		fmt.Printf("   Total chunks: %d\n", len(chunks))
		fmt.Println("   ─────────────────────────────────────────────────")
		for i, chunk := range chunks {
			fmt.Printf("   [%d] ID: %s\n", i, chunk.ID)
			fmt.Printf("       Content (%4d chars): %s\n",
				len(chunk.Content), truncateContent(chunk.Content, 80))
		}
		fmt.Println("   ─────────────────────────────────────────────────")
	}

	// 7. 为每个 chunk 生成 embedding 并存储
	successCount := 0
	failedCount := 0
	var lastError error
	for _, chunk := range chunks {
		if chunk.Content == "" {
			continue
		}

		embedding, err := s.embedder.Embed(chunk.Content)
		if err != nil {
			failedCount++
			lastError = err
			fmt.Printf("⚠️ [RAG] Failed to embed bookmark chunk %s: %v\n", chunk.ID, err)
			continue // 跳过失败的块
		}

		contentHash := HashContent(chunk.Content)
		if err := s.store.Upsert(&BlockVector{
			ID:             chunk.ID,
			SourceBlockID:  blockID, // BookmarkBlock 的 BlockNote ID，用于定位
			DocID:          sourceDocID,
			Content:        chunk.Content,
			ContentHash:    contentHash,
			BlockType:      "bookmark",
			HeadingContext: chunk.HeadingContext,
			Embedding:      embedding,
		}); err != nil {
			fmt.Printf("⚠️ [RAG] Failed to upsert bookmark chunk %s: %v\n", chunk.ID, err)
			failedCount++
		} else {
			successCount++
		}
	}

	// 如果所有 chunks 都嵌入失败，返回错误
	if successCount == 0 && failedCount > 0 {
		return fmt.Errorf("embedding failed: %v", lastError)
	}

	return nil
}

// IndexFileContent 索引文件内容（分块存储）
func (s *Service) IndexFileContent(filePath, sourceDocID, blockID string) error {
	if err := s.init(); err != nil {
		return err
	}

	// 1. 获取完整文件路径
	fullPath := filepath.Join(s.dataPath, strings.TrimPrefix(filePath, "/"))

	// 2. 提取文本内容
	textContent, err := fileextract.ExtractText(fullPath)
	if err != nil {
		return fmt.Errorf("failed to extract text: %w", err)
	}

	if textContent == "" {
		return fmt.Errorf("no text content extracted from file")
	}

	// 3. 构建上下文（使用文件名）
	fileName := filepath.Base(fullPath)
	headingContext := fileName

	// 4. 生成基础 ID
	baseID := fmt.Sprintf("%s_%s_file", sourceDocID, blockID)

	// 5. 删除该 file block 的旧 chunks（修复重新索引时的主键冲突）
	if err := s.store.DeleteBlocksByPrefix(baseID); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete old file chunks for %s: %v\n", baseID, err)
	}

	// 5.1 保存完整提取内容（供 MCP 工具读取）
	if err := s.store.SaveExternalContent(&ExternalBlockContent{
		ID:          fmt.Sprintf("%s_%s", sourceDocID, blockID),
		DocID:       sourceDocID,
		BlockID:     blockID,
		BlockType:   "file",
		FilePath:    filePath,
		Title:       fileName,
		RawContent:  textContent,
		ExtractedAt: time.Now().Unix(),
	}); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to save file content for %s: %v\n", baseID, err)
	}

	// 6. 对内容进行分块
	chunks := ChunkTextContent(textContent, headingContext, baseID, s.indexer.chunkConfig)

	// 如果分块结果为空，创建一个单独的块
	if len(chunks) == 0 {
		chunks = []ExtractedBlock{{
			ID:             baseID,
			Type:           "file",
			Content:        textContent,
			HeadingContext: headingContext,
		}}
	}

	// 调试输出
	if debugChunks {
		fmt.Printf("\n📄 [RAG] Indexing file: %s\n", fileName)
		fmt.Printf("   Total chunks: %d\n", len(chunks))
		fmt.Println("   ─────────────────────────────────────────────────")
		for i, chunk := range chunks {
			fmt.Printf("   [%d] ID: %s\n", i, chunk.ID)
			fmt.Printf("       Content (%4d chars): %s\n",
				len(chunk.Content), truncateContent(chunk.Content, 80))
		}
		fmt.Println("   ─────────────────────────────────────────────────")
	}

	// 7. 为每个 chunk 生成 embedding 并存储
	successCount := 0
	failedCount := 0
	var lastError error
	for _, chunk := range chunks {
		if chunk.Content == "" {
			continue
		}

		embedding, err := s.embedder.Embed(chunk.Content)
		if err != nil {
			failedCount++
			lastError = err
			fmt.Printf("⚠️ [RAG] Failed to embed file chunk %s: %v\n", chunk.ID, err)
			continue // 跳过失败的块
		}

		contentHash := HashContent(chunk.Content)
		if err := s.store.Upsert(&BlockVector{
			ID:             chunk.ID,
			SourceBlockID:  blockID, // FileBlock 的 BlockNote ID，用于定位
			DocID:          sourceDocID,
			Content:        chunk.Content,
			ContentHash:    contentHash,
			BlockType:      "file",
			HeadingContext: chunk.HeadingContext,
			FilePath:       filePath, // 存储文件路径，用于删除时清理物理文件
			Embedding:      embedding,
		}); err != nil {
			fmt.Printf("❌ [RAG] Failed to upsert file chunk %s: %v\n", chunk.ID, err)
			failedCount++
		} else {
			successCount++
			if debugChunks {
				fmt.Printf("✅ [RAG] Stored file chunk: %s\n", chunk.ID)
			}
		}
	}

	// 如果所有 chunks 都嵌入失败，返回错误
	if successCount == 0 && failedCount > 0 {
		return fmt.Errorf("embedding failed: %v", lastError)
	}

	return nil
}

// GetExternalBlockContent 获取外部块的完整提取内容
func (s *Service) GetExternalBlockContent(docID, blockID string) (*ExternalBlockContent, error) {
	if err := s.init(); err != nil {
		return nil, err
	}
	return s.store.GetExternalContent(docID, blockID)
}
