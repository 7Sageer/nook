package handlers

import (
	"path/filepath"
	"sync"
	"time"

	"notion-lite/internal/document"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/watcher"
)

// DocumentHandler 文档操作处理器
type DocumentHandler struct {
	dataPath       string
	docRepo        *document.Repository
	docStorage     *document.Storage
	searchService  *search.Service
	ragService     *rag.Service
	watcherService *watcher.Service

	// RAG 索引 debounce
	indexDebounceMu sync.Mutex
	indexDebounce   map[string]*time.Timer
}

// NewDocumentHandler 创建文档处理器
func NewDocumentHandler(
	dataPath string,
	docRepo *document.Repository,
	docStorage *document.Storage,
	searchService *search.Service,
	ragService *rag.Service,
	watcherService *watcher.Service,
) *DocumentHandler {
	return &DocumentHandler{
		dataPath:       dataPath,
		docRepo:        docRepo,
		docStorage:     docStorage,
		searchService:  searchService,
		ragService:     ragService,
		watcherService: watcherService,
		indexDebounce:  make(map[string]*time.Timer),
	}
}

// markIndexWrite 标记 index.json 即将被写入
func (h *DocumentHandler) markIndexWrite() {
	if h.watcherService != nil {
		indexPath := filepath.Join(h.dataPath, "index.json")
		h.watcherService.MarkWrite(indexPath)
	}
}

// GetDocumentList 获取文档列表
func (h *DocumentHandler) GetDocumentList() (document.Index, error) {
	return h.docRepo.GetAll()
}

// CreateDocument 创建新文档
func (h *DocumentHandler) CreateDocument(title string) (document.Meta, error) {
	h.markIndexWrite()
	doc, err := h.docRepo.Create(title)
	if err == nil && h.watcherService != nil {
		docPath := filepath.Join(h.dataPath, "documents", doc.ID+".json")
		h.watcherService.MarkWrite(docPath)
	}
	return doc, err
}

// DeleteDocument 删除文档
func (h *DocumentHandler) DeleteDocument(id string, cleanupImages func()) error {
	h.markIndexWrite()
	err := h.docRepo.Delete(id)
	if err == nil {
		// 更新搜索索引
		h.searchService.RemoveIndex(id)
		// 删除 RAG 向量索引
		if h.ragService != nil {
			go func() { _ = h.ragService.DeleteDocument(id) }()
		}
		// 异步清理未使用的图像
		if cleanupImages != nil {
			go cleanupImages()
		}
	}
	return err
}

// RenameDocument 重命名文档
func (h *DocumentHandler) RenameDocument(id string, newTitle string) error {
	h.markIndexWrite()
	return h.docRepo.Rename(id, newTitle)
}

// SetActiveDocument 设置当前活动文档
func (h *DocumentHandler) SetActiveDocument(id string) error {
	h.markIndexWrite()
	return h.docRepo.SetActive(id)
}

// LoadDocumentContent 加载指定文档内容
func (h *DocumentHandler) LoadDocumentContent(id string) (string, error) {
	return h.docStorage.Load(id)
}

// SaveDocumentContent 保存指定文档内容
func (h *DocumentHandler) SaveDocumentContent(id string, content string) error {
	// 标记文件路径，避免触发自己的文件监听事件
	if h.watcherService != nil {
		docPath := filepath.Join(h.dataPath, "documents", id+".json")
		h.watcherService.MarkWrite(docPath)
		// 同时标记 index.json（因为 UpdateTimestamp 会修改它）
		indexPath := filepath.Join(h.dataPath, "index.json")
		h.watcherService.MarkWrite(indexPath)
	}
	_ = h.docRepo.UpdateTimestamp(id) // 忽略时间戳更新失败
	err := h.docStorage.Save(id, content)
	if err == nil {
		// 更新搜索索引
		h.searchService.UpdateIndex(id, content)
		// 触发 debounced 异步索引
		h.scheduleIndex(id)
	}
	return err
}

// ReorderDocuments 重新排序文档
func (h *DocumentHandler) ReorderDocuments(ids []string) error {
	h.markIndexWrite()
	return h.docRepo.Reorder(ids)
}

// scheduleIndex 调度 debounced 异步索引
func (h *DocumentHandler) scheduleIndex(docID string) {
	h.indexDebounceMu.Lock()
	defer h.indexDebounceMu.Unlock()

	// 取消之前的定时器
	if timer, exists := h.indexDebounce[docID]; exists {
		timer.Stop()
	}

	// 2 秒后触发索引
	h.indexDebounce[docID] = time.AfterFunc(2*time.Second, func() {
		h.indexDebounceMu.Lock()
		delete(h.indexDebounce, docID)
		h.indexDebounceMu.Unlock()

		// 异步执行索引
		if h.ragService != nil {
			_ = h.ragService.IndexDocument(docID) // 忽略索引错误
		}
	})
}

// SetupFileWatcher 设置文件监听器回调（由 app.startup 调用）
func (h *DocumentHandler) SetupFileWatcher(onFileChanged func(e watcher.FileChangeEvent)) {
	if h.watcherService != nil {
		h.watcherService.OnDocumentChanged = onFileChanged
	}
}

// OnExternalFileChange 处理外部文件变更（由 file watcher 调用）
func (h *DocumentHandler) OnExternalFileChange(e watcher.FileChangeEvent) {
	if e.IsIndex {
		return
	}
	switch e.Type {
	case "create", "write", "rename":
		content, err := h.docStorage.Load(e.DocID)
		if err == nil {
			h.searchService.UpdateIndex(e.DocID, content)
		}
	case "remove":
		h.searchService.RemoveIndex(e.DocID)
	}
}
