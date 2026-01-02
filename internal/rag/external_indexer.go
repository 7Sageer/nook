package rag

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"notion-lite/internal/document"
	"notion-lite/internal/fileextract"
	"notion-lite/internal/opengraph"
)

// ExternalIndexer handles indexing of external content (bookmarks and files)
type ExternalIndexer struct {
	store      *VectorStore
	embedder   EmbeddingClient
	docRepo    *document.Repository
	docStorage *document.Storage
	indexer    *Indexer
	dataPath   string
}

// NewExternalIndexer creates a new external content indexer
func NewExternalIndexer(
	store *VectorStore,
	embedder EmbeddingClient,
	docRepo *document.Repository,
	docStorage *document.Storage,
	indexer *Indexer,
	dataPath string,
) *ExternalIndexer {
	return &ExternalIndexer{
		store:      store,
		embedder:   embedder,
		docRepo:    docRepo,
		docStorage: docStorage,
		indexer:    indexer,
		dataPath:   dataPath,
	}
}

// IndexBookmarkContent 索引书签网页内容（分块存储）
func (e *ExternalIndexer) IndexBookmarkContent(url, sourceDocID, blockID string) error {
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
	if err := e.store.DeleteBlocksByPrefix(baseID); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete old bookmark chunks for %s: %v\n", baseID, err)
	}

	// 5.1 保存完整提取内容（供 MCP 工具读取）
	if err := e.store.SaveExternalContent(&ExternalBlockContent{
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
	chunks := ChunkTextContent(content.TextContent, headingContext, baseID, e.indexer.chunkConfig)

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

		embedding, err := e.embedder.Embed(chunk.Content)
		if err != nil {
			failedCount++
			lastError = err
			fmt.Printf("⚠️ [RAG] Failed to embed bookmark chunk %s: %v\n", chunk.ID, err)
			continue // 跳过失败的块
		}

		contentHash := HashContent(chunk.Content)
		if err := e.store.Upsert(&BlockVector{
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
func (e *ExternalIndexer) IndexFileContent(filePath, sourceDocID, blockID string) error {
	// 1. 获取完整文件路径
	fullPath := filepath.Join(e.dataPath, strings.TrimPrefix(filePath, "/"))

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
	if err := e.store.DeleteBlocksByPrefix(baseID); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete old file chunks for %s: %v\n", baseID, err)
	}

	// 5.1 保存完整提取内容（供 MCP 工具读取）
	if err := e.store.SaveExternalContent(&ExternalBlockContent{
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
	chunks := ChunkTextContent(textContent, headingContext, baseID, e.indexer.chunkConfig)

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

		embedding, err := e.embedder.Embed(chunk.Content)
		if err != nil {
			failedCount++
			lastError = err
			fmt.Printf("⚠️ [RAG] Failed to embed file chunk %s: %v\n", chunk.ID, err)
			continue // 跳过失败的块
		}

		contentHash := HashContent(chunk.Content)
		if err := e.store.Upsert(&BlockVector{
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

// ReindexAll 重新索引所有 bookmark 和 file 块
// 遍历所有文档，提取 bookmark/file 块信息，然后重新抓取和索引
func (e *ExternalIndexer) ReindexAll() (int, error) {
	// 获取所有文档
	index, err := e.docRepo.GetAll()
	if err != nil {
		return 0, fmt.Errorf("failed to get documents: %w", err)
	}

	totalCount := 0
	for _, doc := range index.Documents {
		// 加载文档内容
		content, err := e.docStorage.Load(doc.ID)
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
			if err := e.IndexBookmarkContent(bookmark.URL, doc.ID, bookmark.BlockID); err != nil {
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
			if err := e.IndexFileContent(file.FilePath, doc.ID, file.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex file %s: %v\n", file.BlockID, err)
			} else {
				totalCount++
				fmt.Printf("✅ [RAG] Reindexed file: %s\n", file.FilePath)
			}
		}
	}

	return totalCount, nil
}

// ReindexAllWithProgress 重新索引所有 bookmark 和 file 块（带进度回调）
func (e *ExternalIndexer) ReindexAllWithProgress(onProgress func(current, total int)) (int, error) {
	// 获取所有文档并计算外部块总数
	index, err := e.docRepo.GetAll()
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
		content, err := e.docStorage.Load(doc.ID)
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
			if err := e.IndexBookmarkContent(block.bookmark.URL, block.docID, block.bookmark.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex bookmark %s: %v\n", block.bookmark.BlockID, err)
			} else {
				successCount++
				fmt.Printf("✅ [RAG] Reindexed bookmark: %s\n", block.bookmark.URL)
			}
		} else if block.file != nil {
			if err := e.IndexFileContent(block.file.FilePath, block.docID, block.file.BlockID); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex file %s: %v\n", block.file.BlockID, err)
			} else {
				successCount++
				fmt.Printf("✅ [RAG] Reindexed file: %s\n", block.file.FilePath)
			}
		}
	}

	return successCount, nil
}
