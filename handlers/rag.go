package handlers

import (
	"notion-lite/internal/document"
	"notion-lite/internal/rag"
)

// RAGHandler RAG 配置与索引处理器
type RAGHandler struct {
	dataPath   string
	docRepo    *document.Repository
	ragService *rag.Service
}

// NewRAGHandler 创建 RAG 处理器
func NewRAGHandler(
	dataPath string,
	docRepo *document.Repository,
	ragService *rag.Service,
) *RAGHandler {
	return &RAGHandler{
		dataPath:   dataPath,
		docRepo:    docRepo,
		ragService: ragService,
	}
}

// EmbeddingConfig 嵌入模型配置（前端用）
// Note: This type aliases rag.EmbeddingConfig to avoid breaking the Wails bindings.
// Wails generates TypeScript types from Go structs, and the frontend expects this name.
type EmbeddingConfig = rag.EmbeddingConfig

// RAGStatus RAG 索引状态
type RAGStatus struct {
	Enabled          bool   `json:"enabled"`
	IndexedDocs      int    `json:"indexedDocs"`
	IndexedBookmarks int    `json:"indexedBookmarks"`
	TotalDocs        int    `json:"totalDocs"`
	LastIndexTime    string `json:"lastIndexTime"`
}

// GetRAGConfig 获取 RAG 配置
func (h *RAGHandler) GetRAGConfig() (EmbeddingConfig, error) {
	config, err := rag.LoadConfig(h.dataPath)
	if err != nil {
		return EmbeddingConfig{}, err
	}
	return *config, nil
}

// SaveRAGConfig 保存 RAG 配置
func (h *RAGHandler) SaveRAGConfig(config EmbeddingConfig) error {
	if err := rag.SaveConfig(h.dataPath, &config); err != nil {
		return err
	}
	// 重新初始化 RAG 服务
	return h.ragService.Reinitialize()
}

// GetRAGStatus 获取 RAG 索引状态
func (h *RAGHandler) GetRAGStatus() RAGStatus {
	index, _ := h.docRepo.GetAll()
	totalDocs := len(index.Documents)

	indexedDocs, indexedBookmarks, _ := h.ragService.GetIndexedStats()

	return RAGStatus{
		Enabled:          true,
		IndexedDocs:      indexedDocs,
		IndexedBookmarks: indexedBookmarks,
		TotalDocs:        totalDocs,
		LastIndexTime:    "",
	}
}

// RebuildIndex 重建 RAG 索引
func (h *RAGHandler) RebuildIndex() (int, error) {
	return h.ragService.ReindexAll()
}

// IndexBookmarkContent 索引书签网页内容
func (h *RAGHandler) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	return h.ragService.IndexBookmarkContent(url, sourceDocID, blockID)
}

// IndexFileContent 索引文件内容
func (h *RAGHandler) IndexFileContent(filePath, sourceDocID, blockID string) error {
	return h.ragService.IndexFileContent(filePath, sourceDocID, blockID)
}
