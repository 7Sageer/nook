package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"notion-lite/internal/constant"
	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"notion-lite/internal/markdown"
	"notion-lite/internal/opengraph"
	"notion-lite/internal/search"
	"notion-lite/internal/settings"
	"notion-lite/internal/watcher"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/clipboard"
)

// ========== 前端专用数据结构 ==========

// SearchResult 搜索结果
type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// Settings 用户设置
type Settings struct {
	Theme    string `json:"theme"`
	Language string `json:"language"`
}

// App struct
type App struct {
	ctx             context.Context
	dataPath        string
	docRepo         *document.Repository
	docStorage      *document.Storage
	folderRepo      *folder.Repository
	searchService   *search.Service
	settingsService *settings.Service
	markdownService *markdown.Service
	watcherService  *watcher.Service

	pendingExternalOpensMu sync.Mutex
	pendingExternalOpens   []string
	frontendReady          bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".Nook")
	os.MkdirAll(dataPath, 0755)
	os.MkdirAll(filepath.Join(dataPath, "documents"), 0755)

	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)
	folderRepo := folder.NewRepository(dataPath)

	// 创建文件监听服务
	watcherService, err := watcher.NewService(dataPath)
	if err != nil {
		// 文件监听失败不影响应用启动，仅记录警告
		watcherService = nil
	}

	return &App{
		dataPath:        dataPath,
		docRepo:         docRepo,
		docStorage:      docStorage,
		folderRepo:      folderRepo,
		searchService:   search.NewService(docRepo, docStorage),
		settingsService: settings.NewService(dataPath),
		markdownService: markdown.NewService(),
		watcherService:  watcherService,
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.markdownService.SetContext(ctx)

	// 启动文件监听服务
	if a.watcherService != nil {
		if err := a.watcherService.Start(ctx); err != nil {
			runtime.LogError(ctx, "Failed to start file watcher: "+err.Error())
		}
	}

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

// markIndexWrite 标记 index.json 即将被写入
func (a *App) markIndexWrite() {
	if a.watcherService != nil {
		indexPath := filepath.Join(a.dataPath, "index.json")
		a.watcherService.MarkWrite(indexPath)
	}
}

// GetDocumentList 获取文档列表
func (a *App) GetDocumentList() (document.Index, error) {
	return a.docRepo.GetAll()
}

// CreateDocument 创建新文档
func (a *App) CreateDocument(title string) (document.Meta, error) {
	// 创建文档会修改 index.json 和新建文档文件
	a.markIndexWrite()
	doc, err := a.docRepo.Create(title)
	if err == nil && a.watcherService != nil {
		docPath := filepath.Join(a.dataPath, "documents", doc.ID+".json")
		a.watcherService.MarkWrite(docPath)
	}
	return doc, err
}

// DeleteDocument 删除文档
func (a *App) DeleteDocument(id string) error {
	a.markIndexWrite()
	err := a.docRepo.Delete(id)
	if err == nil {
		// 异步清理未使用的图像
		go a.cleanupUnusedImages()
	}
	return err
}

// RenameDocument 重命名文档
func (a *App) RenameDocument(id string, newTitle string) error {
	a.markIndexWrite()
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
	// 标记文件路径，避免触发自己的文件监听事件
	if a.watcherService != nil {
		docPath := filepath.Join(a.dataPath, "documents", id+".json")
		a.watcherService.MarkWrite(docPath)
		// 同时标记 index.json（因为 UpdateTimestamp 会修改它）
		indexPath := filepath.Join(a.dataPath, "index.json")
		a.watcherService.MarkWrite(indexPath)
	}
	a.docRepo.UpdateTimestamp(id)
	return a.docStorage.Save(id, content)
}

// ========== Markdown 导入/导出 ==========

// ImportMarkdownFile 导入 Markdown 文件
func (a *App) ImportMarkdownFile() (*markdown.ImportResult, error) {
	return a.markdownService.Import()
}

// ExportMarkdownFile 导出为 Markdown 文件
func (a *App) ExportMarkdownFile(content string, defaultName string) error {
	return a.markdownService.Export(content, defaultName)
}

// ExportHTMLFile 导出为 HTML 文件
func (a *App) ExportHTMLFile(content string, defaultName string) error {
	return a.markdownService.ExportHTML(content, defaultName)
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
		return Settings{Theme: "light", Language: "zh"}, nil
	}
	return Settings{Theme: s.Theme, Language: s.Language}, nil
}

// SaveSettings 保存用户设置
func (a *App) SaveSettings(s Settings) error {
	return a.settingsService.Save(settings.Settings{Theme: s.Theme, Language: s.Language})
}

// ========== 文件夹管理 ==========

// GetFolders 获取所有文件夹
func (a *App) GetFolders() ([]folder.Folder, error) {
	return a.folderRepo.GetAll()
}

// CreateFolder 创建新文件夹
func (a *App) CreateFolder(name string) (folder.Folder, error) {
	return a.folderRepo.Create(name)
}

// DeleteFolder 删除文件夹
func (a *App) DeleteFolder(id string) error {
	// 将该文件夹下的文档移到未分类
	index, _ := a.docRepo.GetAll()
	for _, doc := range index.Documents {
		if doc.FolderId == id {
			a.docRepo.MoveToFolder(doc.ID, "")
		}
	}
	return a.folderRepo.Delete(id)
}

// RenameFolder 重命名文件夹
func (a *App) RenameFolder(id string, newName string) error {
	return a.folderRepo.Rename(id, newName)
}

// SetFolderCollapsed 设置文件夹折叠状态
func (a *App) SetFolderCollapsed(id string, collapsed bool) error {
	return a.folderRepo.SetCollapsed(id, collapsed)
}

// MoveDocumentToFolder 将文档移动到指定文件夹
func (a *App) MoveDocumentToFolder(docId string, folderId string) error {
	return a.docRepo.MoveToFolder(docId, folderId)
}

// ReorderDocuments 重新排序文档
func (a *App) ReorderDocuments(ids []string) error {
	return a.docRepo.Reorder(ids)
}

// ReorderFolders 重新排序文件夹
func (a *App) ReorderFolders(ids []string) error {
	return a.folderRepo.Reorder(ids)
}

// AddDocumentTag 为文档添加标签
func (a *App) AddDocumentTag(docId string, tag string) error {
	a.markIndexWrite()
	return a.docRepo.AddTag(docId, tag)
}

// RemoveDocumentTag 移除文档标签
func (a *App) RemoveDocumentTag(docId string, tag string) error {
	a.markIndexWrite()
	return a.docRepo.RemoveTag(docId, tag)
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

// ========== 剪贴板图片 ==========

// CopyImageToClipboard 将 base64 编码的 PNG 图片复制到剪贴板
func (a *App) CopyImageToClipboard(base64Data string) error {
	// Initialize clipboard (required for golang.design/x/clipboard)
	err := clipboard.Init()
	if err != nil {
		return err
	}

	// Decode base64 data
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Write image to clipboard
	clipboard.Write(clipboard.FmtImage, imgData)
	return nil
}

// SaveImage 保存图片到本地并返回文件路径
func (a *App) SaveImage(base64Data string, filename string) (string, error) {
	imagesDir := filepath.Join(a.dataPath, "images")
	os.MkdirAll(imagesDir, 0755)

	imgPath := filepath.Join(imagesDir, filename)

	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(imgPath, imgData, 0644); err != nil {
		return "", err
	}

	// Return /images/ URL for use in the editor (served by ImageHandler)
	return "/images/" + filename, nil
}

// SaveImageFile 保存图片到指定位置（通过文件对话框）
func (a *App) SaveImageFile(base64Data string, defaultName string) error {
	// Decode base64 data first to validate
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Open save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save as Image",
		DefaultFilename: defaultName + ".png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image (*.png)", Pattern: "*.png"},
		},
	})
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil // User cancelled
	}

	// Ensure .png extension
	if !strings.HasSuffix(strings.ToLower(filePath), ".png") {
		filePath += ".png"
	}

	// Write image to file
	return os.WriteFile(filePath, imgData, 0644)
}

// PrintHTML 保存 HTML 到临时文件并在浏览器中打开
func (a *App) PrintHTML(htmlContent string, title string) error {
	// 创建临时目录
	tempDir := filepath.Join(a.dataPath, "temp")
	os.MkdirAll(tempDir, 0755)

	// 生成唯一文件名
	filename := fmt.Sprintf("print_%s_%d.html", sanitizeFilename(title), time.Now().UnixMilli())
	filePath := filepath.Join(tempDir, filename)

	// 写入 HTML 文件
	if err := os.WriteFile(filePath, []byte(htmlContent), 0644); err != nil {
		return err
	}

	// 使用系统命令打开文件（macOS 使用 open 命令）
	cmd := exec.Command("open", filePath)
	return cmd.Start()
}

// sanitizeFilename 清理文件名中的非法字符
func sanitizeFilename(name string) string {
	// 替换非法字符为下划线
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}
	// 限制长度
	if len(result) > 50 {
		result = result[:50]
	}
	return result
}

// ========== Open Graph ==========

// FetchLinkMetadata 获取链接的 Open Graph 元数据
func (a *App) FetchLinkMetadata(url string) (*opengraph.LinkMetadata, error) {
	return opengraph.Fetch(url)
}
