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

// GetIndexedStats 获取索引统计信息
func (s *Service) GetIndexedStats() (int, int, error) {
	if s.store == nil {
		dbPath := filepath.Join(s.dataPath, "vectors.db")
		store, err := NewVectorStore(dbPath, 768) // 默认维度
		if err != nil {
			return 0, 0, nil // 数据库不存在，返回 0
		}
		s.store = store
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

	// 5. 对内容进行分块
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

	// 6. 为每个 chunk 生成 embedding 并存储
	for _, chunk := range chunks {
		if chunk.Content == "" {
			continue
		}

		embedding, err := s.embedder.Embed(chunk.Content)
		if err != nil {
			continue // 跳过失败的块
		}

		contentHash := HashContent(chunk.Content)
		s.store.Upsert(&BlockVector{
			ID:             chunk.ID,
			DocID:          sourceDocID,
			Content:        chunk.Content,
			ContentHash:    contentHash,
			BlockType:      "bookmark",
			HeadingContext: chunk.HeadingContext,
			Embedding:      embedding,
		})
	}

	return nil
}
