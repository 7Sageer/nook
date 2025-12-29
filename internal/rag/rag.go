package rag

import (
	"os"
	"path/filepath"

	"notion-lite/internal/document"
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
