package rag

import (
	"fmt"

	"notion-lite/internal/document"
)

// Indexer 文档索引器
type Indexer struct {
	store       *VectorStore
	embedder    EmbeddingClient
	docRepo     *document.Repository
	docStorage  *document.Storage
	chunkConfig ChunkConfig
}

// NewIndexer 创建索引器
func NewIndexer(store *VectorStore, embedder EmbeddingClient, docRepo *document.Repository, docStorage *document.Storage) *Indexer {
	return &Indexer{
		store:       store,
		embedder:    embedder,
		docRepo:     docRepo,
		docStorage:  docStorage,
		chunkConfig: DefaultChunkConfig,
	}
}

// NewIndexerWithConfig 创建带配置的索引器
func NewIndexerWithConfig(store *VectorStore, embedder EmbeddingClient, docRepo *document.Repository, docStorage *document.Storage, config ChunkConfig) *Indexer {
	return &Indexer{
		store:       store,
		embedder:    embedder,
		docRepo:     docRepo,
		docStorage:  docStorage,
		chunkConfig: config,
	}
}

// SetChunkConfig 更新分块配置
func (idx *Indexer) SetChunkConfig(config ChunkConfig) {
	idx.chunkConfig = config
}

// IndexDocument 索引单个文档（增量更新）
func (idx *Indexer) IndexDocument(docID string) error {
	// 1. 加载文档内容
	content, err := idx.docStorage.Load(docID)
	if err != nil {
		return fmt.Errorf("failed to load document: %w", err)
	}

	// 2. 获取现有块的哈希
	existingHashes, err := idx.store.GetBlockHashes(docID)
	if err != nil {
		existingHashes = make(map[string]string)
	}

	// 3. 使用配置提取新块并计算哈希
	blocks := ExtractBlocksWithConfig([]byte(content), idx.chunkConfig)
	newBlockIDs := make(map[string]bool)

	for _, block := range blocks {
		if block.Content == "" {
			continue
		}
		newBlockIDs[block.ID] = true
		newHash := HashContent(block.Content + block.HeadingContext)

		// 检查是否需要更新
		if oldHash, exists := existingHashes[block.ID]; exists && oldHash == newHash {
			// 内容没变，跳过
			continue
		}

		// 需要更新：生成新的 Embedding
		embedding, err := idx.embedder.Embed(block.Content)
		if err != nil {
			continue
		}
		idx.store.Upsert(&BlockVector{
			ID:             block.ID,
			DocID:          docID,
			Content:        block.Content,
			ContentHash:    newHash,
			BlockType:      block.Type,
			HeadingContext: block.HeadingContext,
			Embedding:      embedding,
		})
	}

	// 4. 删除已不存在的块
	var toDelete []string
	for id := range existingHashes {
		if !newBlockIDs[id] {
			toDelete = append(toDelete, id)
		}
	}
	if len(toDelete) > 0 {
		idx.store.DeleteBlocks(toDelete)
	}

	return nil
}

// ReindexAll 重建所有文档索引
func (idx *Indexer) ReindexAll() (int, error) {
	index, err := idx.docRepo.GetAll()
	if err != nil {
		return 0, fmt.Errorf("failed to get documents: %w", err)
	}

	count := 0
	for _, doc := range index.Documents {
		if err := idx.IndexDocument(doc.ID); err != nil {
			continue // 跳过失败的文档
		}
		count++
	}
	return count, nil
}
