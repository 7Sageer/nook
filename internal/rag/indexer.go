package rag

import (
	"fmt"
	"os"
	"strings"

	"notion-lite/internal/document"
)

// debugChunks 是否输出 chunk 调试信息（通过环境变量 DEBUG_RAG_CHUNKS=1 启用）
var debugChunks = os.Getenv("DEBUG_RAG_CHUNKS") == "1"

// truncateContent 截断内容用于显示
func truncateContent(s string, maxLen int) string {
	s = strings.ReplaceAll(s, "\n", "↵ ")
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}

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

	// 调试输出：显示分块详情
	if debugChunks {
		fmt.Printf("\n📄 [RAG] Indexing document: %s\n", docID)
		fmt.Printf("   Total chunks: %d\n", len(blocks))
		fmt.Println("   ─────────────────────────────────────────────────")
		for i, block := range blocks {
			fmt.Printf("   [%d] Type: %-25s | Heading: %s\n",
				i, block.Type, truncateContent(block.HeadingContext, 30))
			fmt.Printf("       Content (%4d chars): %s\n",
				len(block.Content), truncateContent(block.Content, 80))
		}
		fmt.Println("   ─────────────────────────────────────────────────")
	}

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
		// 若 block 本身是聚合/合并块，使用其 SourceBlockID；否则使用 block.ID
		sourceBlockID := block.SourceBlockID
		if sourceBlockID == "" {
			sourceBlockID = block.ID
		}
		idx.store.Upsert(&BlockVector{
			ID:             block.ID,
			SourceBlockID:  sourceBlockID,
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
		// 常规块：如果在新的块列表中不存在，且不是 bookmark，则删除
		if !newBlockIDs[id] && !strings.Contains(id, "_bookmark") {
			toDelete = append(toDelete, id)
		}
	}
	if len(toDelete) > 0 {
		idx.store.DeleteBlocks(toDelete)
	}

	// 5. 清理孤儿 bookmark（即在编辑器中已删除的 bookmark）
	currentBookmarkBlockIDs := ExtractBookmarkBlockIDs([]byte(content))
	if err := idx.store.DeleteOrphanBookmarks(docID, currentBookmarkBlockIDs); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete orphan bookmarks for doc %s: %v\n", docID, err)
	}

	return nil
}

// ForceReindexDocument 强制重建单个文档索引（删除所有旧块后重新索引）
func (idx *Indexer) ForceReindexDocument(docID string) error {
	// 1. 加载文档内容
	content, err := idx.docStorage.Load(docID)
	if err != nil {
		return fmt.Errorf("failed to load document: %w", err)
	}

	// 2. 清理旧索引
	// 删除该文档的所有非 bookmark 块
	idx.store.DeleteNonBookmarkByDocID(docID)

	// 清理孤儿 bookmark（保留当前存在的）
	currentBookmarkBlockIDs := ExtractBookmarkBlockIDs([]byte(content))
	if err := idx.store.DeleteOrphanBookmarks(docID, currentBookmarkBlockIDs); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete orphan bookmarks for doc %s: %v\n", docID, err)
	}

	// 3. 使用新配置提取块
	blocks := ExtractBlocksWithConfig([]byte(content), idx.chunkConfig)

	// 调试输出
	if debugChunks {
		fmt.Printf("\n📄 [RAG] Force reindexing document: %s\n", docID)
		fmt.Printf("   Total chunks: %d\n", len(blocks))
		fmt.Println("   ─────────────────────────────────────────────────")
		for i, block := range blocks {
			fmt.Printf("   [%d] Type: %-25s | Heading: %s\n",
				i, block.Type, truncateContent(block.HeadingContext, 30))
			fmt.Printf("       Content (%4d chars): %s\n",
				len(block.Content), truncateContent(block.Content, 80))
		}
		fmt.Println("   ─────────────────────────────────────────────────")
	}

	// 4. 为每个块生成 embedding 并存储
	for _, block := range blocks {
		if block.Content == "" {
			continue
		}

		embedding, err := idx.embedder.Embed(block.Content)
		if err != nil {
			continue
		}

		// 若 block 本身是聚合/合并块，使用其 SourceBlockID；否则使用 block.ID
		sourceBlockID := block.SourceBlockID
		if sourceBlockID == "" {
			sourceBlockID = block.ID
		}

		newHash := HashContent(block.Content + block.HeadingContext)
		idx.store.Upsert(&BlockVector{
			ID:             block.ID,
			SourceBlockID:  sourceBlockID,
			DocID:          docID,
			Content:        block.Content,
			ContentHash:    newHash,
			BlockType:      block.Type,
			HeadingContext: block.HeadingContext,
			Embedding:      embedding,
		})
	}

	return nil
}

// ReindexAll 重建所有文档索引（强制模式，清除旧数据，清理孤儿块）
func (idx *Indexer) ReindexAll() (int, error) {
	index, err := idx.docRepo.GetAll()
	if err != nil {
		return 0, fmt.Errorf("failed to get documents: %w", err)
	}

	// 构建现有文档 ID 集合
	existingDocIDs := make(map[string]bool)
	for _, doc := range index.Documents {
		existingDocIDs[doc.ID] = true
	}

	// 清理已删除文档的孤儿块
	indexedDocIDs, err := idx.store.GetAllDocIDs()
	if err == nil {
		for _, docID := range indexedDocIDs {
			if !existingDocIDs[docID] {
				if debugChunks {
					fmt.Printf("🗑️ [RAG] Cleaning orphan blocks for deleted document: %s\n", docID)
				}
				idx.store.DeleteByDocID(docID)
			}
		}
	}

	// 重建索引
	count := 0
	for _, doc := range index.Documents {
		if err := idx.ForceReindexDocument(doc.ID); err != nil {
			continue // 跳过失败的文档
		}
		count++
	}
	return count, nil
}
