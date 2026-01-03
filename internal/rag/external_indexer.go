package rag

import (
	"fmt"
	"os"
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

// FolderIndexResult 文件夹索引结果
type FolderIndexResult struct {
	TotalFiles   int      `json:"totalFiles"`
	SuccessCount int      `json:"successCount"`
	FailedCount  int      `json:"failedCount"`
	FailedFiles  []string `json:"failedFiles"`
}

// supportedExtensions 支持索引的文件扩展名
var supportedExtensions = map[string]bool{
	".pdf":  true,
	".docx": true,
	".xlsx": true,
	".epub": true,
	".html": true,
	".htm":  true,
	".txt":  true,
	".md":   true,
}

// IndexFolderContent 索引文件夹内容（全量重建）
// maxDepth 控制递归深度，0 表示只处理当前目录，-1 表示无限深度
func (e *ExternalIndexer) IndexFolderContent(folderPath, sourceDocID, blockID string, maxDepth int) (*FolderIndexResult, error) {
	fmt.Printf("\n📁 [RAG] IndexFolderContent called: folder=%s, docID=%s, blockID=%s\n", folderPath, sourceDocID, blockID)

	// 1. 设置默认深度
	if maxDepth <= 0 {
		maxDepth = 10 // 默认最大 10 层
	}

	// 2. 生成基础 ID 并删除旧数据
	baseID := fmt.Sprintf("%s_%s_folder", sourceDocID, blockID)
	if err := e.store.DeleteBlocksByPrefix(baseID); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to delete old folder chunks for %s: %v\n", baseID, err)
	}

	// 3. 收集文件夹中所有支持的文件
	var files []string
	err := e.walkFolder(folderPath, 0, maxDepth, &files)
	if err != nil {
		fmt.Printf("❌ [RAG] Failed to walk folder: %v\n", err)
		return nil, fmt.Errorf("failed to walk folder: %w", err)
	}

	fmt.Printf("📁 [RAG] Found %d supported files in folder\n", len(files))
	if debugChunks {
		for i, f := range files {
			fmt.Printf("   [%d] %s\n", i, f)
		}
	}

	if len(files) == 0 {
		fmt.Printf("📁 [RAG] No supported files found in folder, returning empty result\n")
		return &FolderIndexResult{
			TotalFiles:   0,
			SuccessCount: 0,
			FailedCount:  0,
			FailedFiles:  nil,
		}, nil
	}

	// 4. 索引每个文件
	result := &FolderIndexResult{
		TotalFiles:  len(files),
		FailedFiles: make([]string, 0),
	}

	folderName := filepath.Base(folderPath)

	for fileIndex, filePath := range files {
		// 提取文本内容
		textContent, err := fileextract.ExtractText(filePath)
		if err != nil {
			result.FailedCount++
			result.FailedFiles = append(result.FailedFiles, filepath.Base(filePath))
			fmt.Printf("⚠️ [RAG] Failed to extract text from %s: %v\n", filePath, err)
			continue
		}

		if textContent == "" {
			result.FailedCount++
			result.FailedFiles = append(result.FailedFiles, filepath.Base(filePath))
			continue
		}

		// 构建上下文（文件夹名/文件名）
		fileName := filepath.Base(filePath)
		headingContext := fmt.Sprintf("%s/%s", folderName, fileName)

		// 生成文件级别的 ID
		fileID := fmt.Sprintf("%s_%d", baseID, fileIndex)

		// 对内容进行分块
		chunks := ChunkTextContent(textContent, headingContext, fileID, e.indexer.chunkConfig)

		if len(chunks) == 0 {
			chunks = []ExtractedBlock{{
				ID:             fileID,
				Type:           "folder",
				Content:        textContent,
				HeadingContext: headingContext,
			}}
		}

		// 为每个 chunk 生成 embedding 并存储
		fileSuccess := false
		for _, chunk := range chunks {
			if chunk.Content == "" {
				continue
			}

			embedding, err := e.embedder.Embed(chunk.Content)
			if err != nil {
				fmt.Printf("⚠️ [RAG] Failed to embed folder chunk %s: %v\n", chunk.ID, err)
				continue
			}

			contentHash := HashContent(chunk.Content)
			if err := e.store.Upsert(&BlockVector{
				ID:             chunk.ID,
				SourceBlockID:  blockID,
				DocID:          sourceDocID,
				Content:        chunk.Content,
				ContentHash:    contentHash,
				BlockType:      "folder",
				HeadingContext: chunk.HeadingContext,
				FilePath:       filePath,
				Embedding:      embedding,
			}); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to upsert folder chunk %s: %v\n", chunk.ID, err)
			} else {
				fileSuccess = true
			}
		}

		if fileSuccess {
			result.SuccessCount++
		} else {
			result.FailedCount++
			result.FailedFiles = append(result.FailedFiles, fileName)
		}
	}

	// 5. 保存文件夹级别元数据
	if err := e.store.SaveExternalContent(&ExternalBlockContent{
		ID:          fmt.Sprintf("%s_%s", sourceDocID, blockID),
		DocID:       sourceDocID,
		BlockID:     blockID,
		BlockType:   "folder",
		FilePath:    folderPath,
		Title:       folderName,
		RawContent:  fmt.Sprintf("Folder: %s\nTotal files: %d\nIndexed: %d", folderPath, result.TotalFiles, result.SuccessCount),
		ExtractedAt: time.Now().Unix(),
	}); err != nil {
		fmt.Printf("⚠️ [RAG] Failed to save folder metadata for %s: %v\n", baseID, err)
	}

	fmt.Printf("✅ [RAG] Folder indexing complete: %d/%d files indexed\n", result.SuccessCount, result.TotalFiles)
	return result, nil
}

// walkFolder 递归遍历文件夹，收集支持的文件
func (e *ExternalIndexer) walkFolder(dir string, currentDepth, maxDepth int, files *[]string) error {
	if currentDepth > maxDepth {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		fullPath := filepath.Join(dir, entry.Name())

		if entry.IsDir() {
			// 跳过隐藏目录和常见的无关目录
			name := entry.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "vendor" || name == "__pycache__" {
				continue
			}
			// 递归处理子目录
			if err := e.walkFolder(fullPath, currentDepth+1, maxDepth, files); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to walk subdir %s: %v\n", fullPath, err)
			}
		} else {
			// 检查是否是支持的文件类型
			ext := strings.ToLower(filepath.Ext(entry.Name()))
			if supportedExtensions[ext] {
				*files = append(*files, fullPath)
			}
		}
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

		// 重新索引 folder 块
		for _, folder := range externalIDs.FolderBlocks {
			if folder.FolderPath == "" {
				continue
			}
			if _, err := e.IndexFolderContent(folder.FolderPath, doc.ID, folder.BlockID, 0); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex folder %s: %v\n", folder.BlockID, err)
			} else {
				totalCount++
				fmt.Printf("✅ [RAG] Reindexed folder: %s\n", folder.FolderPath)
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
		folder   *FolderBlockInfo
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
					folder   *FolderBlockInfo
				}{docID: doc.ID, bookmark: &externalIDs.BookmarkBlocks[i]})
			}
		}
		for i := range externalIDs.FileBlocks {
			if externalIDs.FileBlocks[i].FilePath != "" {
				allExternalBlocks = append(allExternalBlocks, struct {
					docID    string
					bookmark *BookmarkBlockInfo
					file     *FileBlockInfo
					folder   *FolderBlockInfo
				}{docID: doc.ID, file: &externalIDs.FileBlocks[i]})
			}
		}
		for i := range externalIDs.FolderBlocks {
			if externalIDs.FolderBlocks[i].FolderPath != "" {
				allExternalBlocks = append(allExternalBlocks, struct {
					docID    string
					bookmark *BookmarkBlockInfo
					file     *FileBlockInfo
					folder   *FolderBlockInfo
				}{docID: doc.ID, folder: &externalIDs.FolderBlocks[i]})
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
		} else if block.folder != nil {
			if _, err := e.IndexFolderContent(block.folder.FolderPath, block.docID, block.folder.BlockID, 0); err != nil {
				fmt.Printf("⚠️ [RAG] Failed to reindex folder %s: %v\n", block.folder.BlockID, err)
			} else {
				successCount++
				fmt.Printf("✅ [RAG] Reindexed folder: %s\n", block.folder.FolderPath)
			}
		}
	}

	return successCount, nil
}
