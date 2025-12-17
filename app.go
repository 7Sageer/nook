package main

import (
	"context"
	"os"
	"path/filepath"
	"sync"

	"notion-lite/internal/document"
	"notion-lite/internal/markdown"
	"notion-lite/internal/search"
	"notion-lite/internal/settings"
	"notion-lite/internal/constant"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ========== 数据结构（保持与前端兼容） ==========

// DocumentMeta 文档元数据
type DocumentMeta struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// DocumentIndex 文档索引
type DocumentIndex struct {
	Documents []DocumentMeta `json:"documents"`
	ActiveID  string         `json:"activeId"`
}

// SearchResult 搜索结果
type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// Settings 用户设置
type Settings struct {
	Theme string `json:"theme"`
}

// App struct
type App struct {
	ctx             context.Context
	dataPath        string
	docRepo         *document.Repository
	docStorage      *document.Storage
	searchService   *search.Service
	settingsService *settings.Service
	markdownService *markdown.Service

	pendingExternalOpensMu sync.Mutex
	pendingExternalOpens   []string
	frontendReady          bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".nostalgia")
	os.MkdirAll(dataPath, 0755)
	os.MkdirAll(filepath.Join(dataPath, "documents"), 0755)

	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)

	return &App{
		dataPath:        dataPath,
		docRepo:         docRepo,
		docStorage:      docStorage,
		searchService:   search.NewService(docRepo, docStorage),
		settingsService: settings.NewService(dataPath),
		markdownService: markdown.NewService(),
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.markdownService.SetContext(ctx)
	runtime.EventsOn(ctx, "app:frontend-ready", func(_ ...interface{}) {
		a.pendingExternalOpensMu.Lock()
		a.frontendReady = true
		a.pendingExternalOpensMu.Unlock()
		a.flushPendingExternalFileOpens()
	})
}

// ========== 文档列表管理 ==========

func (a *App) handleExternalFileOpen(filePath string) {
	if filePath == "" {
		return
	}

	a.pendingExternalOpensMu.Lock()
	isReady := a.frontendReady && a.ctx != nil
	if !isReady {
		a.pendingExternalOpens = append(a.pendingExternalOpens, filePath)
		a.pendingExternalOpensMu.Unlock()
		return
	}
	ctx := a.ctx
	a.pendingExternalOpensMu.Unlock()

	runtime.EventsEmit(ctx, "file:open-external", filePath)
}

func (a *App) flushPendingExternalFileOpens() {
	a.pendingExternalOpensMu.Lock()
	if !a.frontendReady || a.ctx == nil || len(a.pendingExternalOpens) == 0 {
		a.pendingExternalOpensMu.Unlock()
		return
	}
	paths := append([]string(nil), a.pendingExternalOpens...)
	a.pendingExternalOpens = nil
	ctx := a.ctx
	a.pendingExternalOpensMu.Unlock()

	for _, path := range paths {
		if path == "" {
			continue
		}
		runtime.EventsEmit(ctx, "file:open-external", path)
	}
}

// GetDocumentList 获取文档列表
func (a *App) GetDocumentList() (DocumentIndex, error) {
	index, err := a.docRepo.GetAll()
	if err != nil {
		return DocumentIndex{}, err
	}
	// 转换为前端兼容的类型
	docs := make([]DocumentMeta, len(index.Documents))
	for i, d := range index.Documents {
		docs[i] = DocumentMeta{
			ID:        d.ID,
			Title:     d.Title,
			CreatedAt: d.CreatedAt,
			UpdatedAt: d.UpdatedAt,
		}
	}
	return DocumentIndex{Documents: docs, ActiveID: index.ActiveID}, nil
}

// CreateDocument 创建新文档
func (a *App) CreateDocument(title string) (DocumentMeta, error) {
	doc, err := a.docRepo.Create(title)
	if err != nil {
		return DocumentMeta{}, err
	}
	return DocumentMeta{
		ID:        doc.ID,
		Title:     doc.Title,
		CreatedAt: doc.CreatedAt,
		UpdatedAt: doc.UpdatedAt,
	}, nil
}

// DeleteDocument 删除文档
func (a *App) DeleteDocument(id string) error {
	return a.docRepo.Delete(id)
}

// RenameDocument 重命名文档
func (a *App) RenameDocument(id string, newTitle string) error {
	return a.docRepo.Rename(id, newTitle)
}

// SetActiveDocument 设置当前活动文档
func (a *App) SetActiveDocument(id string) error {
	return a.docRepo.SetActive(id)
}

// ========== 文档内容管理 ==========

// LoadDocumentContent 加载指定文档内容
func (a *App) LoadDocumentContent(id string) (string, error) {
	return a.docStorage.Load(id)
}

// SaveDocumentContent 保存指定文档内容
func (a *App) SaveDocumentContent(id string, content string) error {
	a.docRepo.UpdateTimestamp(id)
	return a.docStorage.Save(id, content)
}

// ========== Markdown 导入/导出 ==========

// ImportMarkdownFile 导入 Markdown 文件
func (a *App) ImportMarkdownFile() (string, error) {
	return a.markdownService.Import()
}

// ExportMarkdownFile 导出为 Markdown 文件
func (a *App) ExportMarkdownFile(content string, defaultName string) error {
	return a.markdownService.Export(content, defaultName)
}

// ========== 搜索 ==========

// SearchDocuments 搜索文档
func (a *App) SearchDocuments(query string) ([]SearchResult, error) {
	results, err := a.searchService.Search(query)
	if err != nil {
		return nil, err
	}
	// 转换为前端兼容的类型
	searchResults := make([]SearchResult, len(results))
	for i, r := range results {
		searchResults[i] = SearchResult{
			ID:      r.ID,
			Title:   r.Title,
			Snippet: r.Snippet,
		}
	}
	return searchResults, nil
}

// ========== 设置 ==========

// GetSettings 获取用户设置
func (a *App) GetSettings() (Settings, error) {
	s, err := a.settingsService.Get()
	if err != nil {
		return Settings{Theme: "light"}, nil
	}
	return Settings{Theme: s.Theme}, nil
}

// SaveSettings 保存用户设置
func (a *App) SaveSettings(s Settings) error {
	return a.settingsService.Save(settings.Settings{Theme: s.Theme})
}

// ========== 外部文件编辑 ==========

// ExternalFile 外部文件信息
type ExternalFile struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Content string `json:"content"`
}

// OpenExternalFile 打开外部文件对话框并读取内容
func (a *App) OpenExternalFile() (ExternalFile, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: constant.DialogTitleOpenFile,
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterTextAndMarkdown, Pattern: "*.txt;*.md"},
			{DisplayName: constant.FilterMarkdown, Pattern: "*.md"},
			{DisplayName: constant.FilterText, Pattern: "*.txt"},
			{DisplayName: constant.FilterAll, Pattern: "*.*"},
		},
	})
	if err != nil {
		return ExternalFile{}, err
	}
	if filePath == "" {
		return ExternalFile{}, nil // 用户取消
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return ExternalFile{}, err
	}

	return ExternalFile{
		Path:    filePath,
		Name:    filepath.Base(filePath),
		Content: string(data),
	}, nil
}

// SaveExternalFile 保存内容到外部文件
func (a *App) SaveExternalFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

// LoadExternalFile 读取指定路径的文件内容
func (a *App) LoadExternalFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
