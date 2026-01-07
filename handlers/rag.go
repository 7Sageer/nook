package handlers

import (
	"context"

	"notion-lite/internal/document"
	"notion-lite/internal/rag"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ReindexProgress 重建索引进度信息
type ReindexProgress struct {
	Phase   string `json:"phase"`   // "documents" | "external"
	Current int    `json:"current"` // 当前处理的索引
	Total   int    `json:"total"`   // 总数
}

// RAGHandler RAG 配置与索引处理器
type RAGHandler struct {
	*BaseHandler
	docRepo    *document.Repository
	ragService *rag.Service
}

// SetContext 设置 Wails 上下文（用于发送事件）
func (h *RAGHandler) SetContext(ctx context.Context) {
	h.BaseHandler.SetContext(ctx)
	h.ragService.SetContext(ctx)
}

// NewRAGHandler 创建 RAG 处理器
func NewRAGHandler(
	base *BaseHandler,
	docRepo *document.Repository,
	ragService *rag.Service,
) *RAGHandler {
	return &RAGHandler{
		BaseHandler: base,
		docRepo:     docRepo,
		ragService:  ragService,
	}
}

// Warmup 预热 RAG 服务（初始化组件，不做搜索）
func (h *RAGHandler) Warmup() error {
	return h.ragService.Warmup()
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
	IndexedFiles     int    `json:"indexedFiles"`
	IndexedFolders   int    `json:"indexedFolders"`
	TotalDocs        int    `json:"totalDocs"`
	LastIndexTime    string `json:"lastIndexTime"`
}

// GetRAGConfig 获取 RAG 配置
func (h *RAGHandler) GetRAGConfig() (EmbeddingConfig, error) {
	config, err := rag.LoadConfig(h.Paths())
	if err != nil {
		return EmbeddingConfig{}, err
	}
	return *config, nil
}

// SaveRAGConfig 保存 RAG 配置
func (h *RAGHandler) SaveRAGConfig(config EmbeddingConfig) error {
	if err := rag.SaveConfig(h.Paths(), &config); err != nil {
		return err
	}
	// 重新初始化 RAG 服务
	return h.ragService.Reinitialize()
}

// GetRAGStatus 获取 RAG 索引状态
func (h *RAGHandler) GetRAGStatus() RAGStatus {
	index, _ := h.docRepo.GetAll()
	totalDocs := len(index.Documents)

	indexedDocs, indexedBookmarks, indexedFiles, indexedFolders, _ := h.ragService.GetIndexedStats()

	return RAGStatus{
		Enabled:          true,
		IndexedDocs:      indexedDocs,
		IndexedBookmarks: indexedBookmarks,
		IndexedFiles:     indexedFiles,
		IndexedFolders:   indexedFolders,
		TotalDocs:        totalDocs,
		LastIndexTime:    "",
	}
}

// RebuildIndex 重建 RAG 索引（带进度通知）
func (h *RAGHandler) RebuildIndex() (int, error) {
	// 文档索引阶段
	docCount, err := h.ragService.ReindexAllWithProgress(func(current, total int) {
		if h.Context() != nil {
			runtime.EventsEmit(h.Context(), "rag:reindex-progress", ReindexProgress{
				Phase:   "documents",
				Current: current,
				Total:   total,
			})
		}
	})
	if err != nil {
		return docCount, err
	}

	// 外部内容索引阶段（书签和文件）
	extCount, err := h.ragService.ReindexExternalContentWithProgress(func(current, total int) {
		if h.Context() != nil {
			runtime.EventsEmit(h.Context(), "rag:reindex-progress", ReindexProgress{
				Phase:   "external",
				Current: current,
				Total:   total,
			})
		}
	})
	if err != nil {
		return docCount + extCount, err
	}

	return docCount + extCount, nil
}

// IndexBookmarkContent 索引书签网页内容
func (h *RAGHandler) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	err := h.ragService.IndexBookmarkContent(url, sourceDocID, blockID)
	if err == nil && h.Context() != nil {
		runtime.EventsEmit(h.Context(), "rag:status-updated", nil)
	}
	return err
}

// IndexFileContent 索引文件内容
func (h *RAGHandler) IndexFileContent(filePath, sourceDocID, blockID, fileName string) error {
	err := h.ragService.IndexFileContent(filePath, sourceDocID, blockID, fileName)
	if err == nil && h.Context() != nil {
		runtime.EventsEmit(h.Context(), "rag:status-updated", nil)
	}
	return err
}

// ExternalBlockContent 外部块完整内容（前端用）
type ExternalBlockContent = rag.ExternalBlockContent

// GetExternalBlockContent 获取外部块的完整提取内容
func (h *RAGHandler) GetExternalBlockContent(docID, blockID string) (*ExternalBlockContent, error) {
	return h.ragService.GetExternalBlockContent(docID, blockID)
}

// GraphData 图谱数据（前端用）
type GraphData = rag.GraphData

// GetDocumentGraph 获取文档关系图谱
func (h *RAGHandler) GetDocumentGraph(threshold float32) (*GraphData, error) {
	return h.ragService.GetDocumentGraph(threshold)
}

// FolderIndexResult 文件夹索引结果（前端用）
type FolderIndexResult = rag.FolderIndexResult

// IndexFolderContent 索引文件夹内容
func (h *RAGHandler) IndexFolderContent(folderPath, sourceDocID, blockID string) (*FolderIndexResult, error) {
	result, err := h.ragService.IndexFolderContent(folderPath, sourceDocID, blockID)
	if err == nil && h.Context() != nil {
		runtime.EventsEmit(h.Context(), "rag:status-updated", nil)
	}
	return result, err
}
