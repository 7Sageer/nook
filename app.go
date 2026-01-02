package main

import (
	"context"
	"os"
	"path/filepath"
	stdruntime "runtime"
	"strings"
	"sync"

	"notion-lite/handlers"
	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"notion-lite/internal/markdown"
	"notion-lite/internal/opengraph"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/settings"
	"notion-lite/internal/tag"
	"notion-lite/internal/watcher"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx             context.Context
	dataPath        string
	docRepo         *document.Repository
	docStorage      *document.Storage
	searchService   *search.Service
	settingsService *settings.Service
	markdownService *markdown.Service
	watcherService  *watcher.Service
	tagStore        *tag.Store
	ragService      *rag.Service

	// Handlers
	documentHandler *handlers.DocumentHandler
	searchHandler   *handlers.SearchHandler
	ragHandler      *handlers.RAGHandler
	settingsHandler *handlers.SettingsHandler
	tagHandler      *handlers.TagHandler
	fileHandler     *handlers.FileHandler

	pendingExternalOpensMu sync.Mutex
	pendingExternalOpens   []string
	frontendReady          bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".Nook")
	_ = os.MkdirAll(dataPath, 0755)                             // 忽略错误
	_ = os.MkdirAll(filepath.Join(dataPath, "documents"), 0755) // 忽略错误

	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)
	folderRepo := folder.NewRepository(dataPath)
	searchService := search.NewService(docRepo, docStorage)
	settingsService := settings.NewService(dataPath)
	markdownService := markdown.NewService()
	tagStore := tag.NewStore(dataPath)
	ragService := rag.NewService(dataPath, docRepo, docStorage)

	// 创建文件监听服务
	watcherService, err := watcher.NewService(dataPath)
	if err != nil {
		watcherService = nil
	}

	app := &App{
		dataPath:        dataPath,
		docRepo:         docRepo,
		docStorage:      docStorage,
		searchService:   searchService,
		settingsService: settingsService,
		markdownService: markdownService,
		watcherService:  watcherService,
		tagStore:        tagStore,
		ragService:      ragService,
	}

	// 初始化 Handlers
	app.documentHandler = handlers.NewDocumentHandler(
		dataPath, docRepo, docStorage, searchService, ragService, watcherService,
	)
	app.searchHandler = handlers.NewSearchHandler(docRepo, searchService, ragService)
	app.ragHandler = handlers.NewRAGHandler(dataPath, docRepo, ragService)
	app.settingsHandler = handlers.NewSettingsHandler(settingsService)
	app.tagHandler = handlers.NewTagHandler(dataPath, docRepo, tagStore, folderRepo, watcherService)
	app.fileHandler = handlers.NewFileHandler(context.TODO(), dataPath, markdownService)

	return app
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.markdownService.SetContext(ctx)
	a.fileHandler.SetContext(ctx)
	a.ragHandler.SetContext(ctx)

	// 一次性迁移：将文件夹转换为标签组
	a.tagHandler.MigrateFoldersToTagGroups()

	// 启动文件监听服务
	if a.watcherService != nil {
		a.watcherService.OnDocumentChanged = func(e watcher.FileChangeEvent) {
			if e.IsIndex {
				return
			}
			switch e.Type {
			case "create", "write", "rename":
				content, err := a.docStorage.Load(e.DocID)
				if err == nil {
					a.searchService.UpdateIndex(e.DocID, content)
				}
			case "remove":
				a.searchService.RemoveIndex(e.DocID)
			}
		}

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

	// 异步构建搜索索引
	go a.searchService.BuildIndex()
}

// shutdown 应用关闭时调用
func (a *App) shutdown(ctx context.Context) {
	if a.watcherService != nil {
		a.watcherService.Stop()
	}
	a.Cleanup()
}

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

// ========== 文档 API (委托给 DocumentHandler) ==========

func (a *App) GetDocumentList() (document.Index, error) {
	return a.documentHandler.GetDocumentList()
}

func (a *App) CreateDocument(title string) (document.Meta, error) {
	return a.documentHandler.CreateDocument(title)
}

func (a *App) DeleteDocument(id string) error {
	return a.documentHandler.DeleteDocument(id, a.cleanupUnusedImages)
}

func (a *App) RenameDocument(id string, newTitle string) error {
	return a.documentHandler.RenameDocument(id, newTitle)
}

func (a *App) SetActiveDocument(id string) error {
	return a.documentHandler.SetActiveDocument(id)
}

func (a *App) LoadDocumentContent(id string) (string, error) {
	return a.documentHandler.LoadDocumentContent(id)
}

func (a *App) SaveDocumentContent(id string, content string) error {
	return a.documentHandler.SaveDocumentContent(id, content)
}

func (a *App) ReorderDocuments(ids []string) error {
	return a.documentHandler.ReorderDocuments(ids)
}

// ========== 搜索 API (委托给 SearchHandler) ==========

func (a *App) SearchDocuments(query string) ([]handlers.SearchResult, error) {
	return a.searchHandler.SearchDocuments(query)
}

func (a *App) SemanticSearch(query string, limit int) ([]handlers.SemanticSearchResult, error) {
	return a.searchHandler.SemanticSearch(query, limit)
}

func (a *App) SemanticSearchDocuments(query string, limit int) ([]handlers.DocumentSearchResult, error) {
	return a.searchHandler.SemanticSearchDocuments(query, limit)
}

// ========== RAG API (委托给 RAGHandler) ==========

func (a *App) GetRAGConfig() (handlers.EmbeddingConfig, error) {
	return a.ragHandler.GetRAGConfig()
}

func (a *App) SaveRAGConfig(config handlers.EmbeddingConfig) error {
	return a.ragHandler.SaveRAGConfig(config)
}

func (a *App) GetRAGStatus() handlers.RAGStatus {
	return a.ragHandler.GetRAGStatus()
}

func (a *App) RebuildIndex() (int, error) {
	return a.ragHandler.RebuildIndex()
}

// IndexBookmarkContent 索引书签网页内容
func (a *App) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	return a.ragHandler.IndexBookmarkContent(url, sourceDocID, blockID)
}

// ========== FileBlock API (委托给 FileHandler/RAGHandler) ==========

// SaveFile 保存文件到 ~/.Nook/files/
func (a *App) SaveFile(base64Data string, originalName string) (*handlers.FileInfo, error) {
	return a.fileHandler.SaveFile(base64Data, originalName)
}

// OpenFileDialog 打开文件选择对话框
func (a *App) OpenFileDialog() (*handlers.FileInfo, error) {
	return a.fileHandler.OpenFileDialog()
}

// OpenFileWithSystem 使用系统默认应用打开文件
func (a *App) OpenFileWithSystem(relativePath string) error {
	return a.fileHandler.OpenFileWithSystem(relativePath)
}

// RevealInFinder 在文件管理器中显示文件
func (a *App) RevealInFinder(relativePath string) error {
	return a.fileHandler.RevealInFinder(relativePath)
}

// IndexFileContent 索引文件内容
func (a *App) IndexFileContent(filePath, sourceDocID, blockID string) error {
	return a.ragHandler.IndexFileContent(filePath, sourceDocID, blockID)
}

// GetExternalBlockContent 获取外部块的完整提取内容
func (a *App) GetExternalBlockContent(docID, blockID string) (*handlers.ExternalBlockContent, error) {
	return a.ragHandler.GetExternalBlockContent(docID, blockID)
}

// ========== 设置 API (委托给 SettingsHandler) ==========

func (a *App) GetSettings() (handlers.Settings, error) {
	return a.settingsHandler.GetSettings()
}

func (a *App) SaveSettings(s handlers.Settings) error {
	return a.settingsHandler.SaveSettings(s)
}

// ========== 标签 API (委托给 TagHandler) ==========

func (a *App) AddDocumentTag(docId string, tagName string) error {
	return a.tagHandler.AddDocumentTag(docId, tagName)
}

func (a *App) RemoveDocumentTag(docId string, tagName string) error {
	return a.tagHandler.RemoveDocumentTag(docId, tagName)
}

func (a *App) GetAllTags() ([]handlers.TagInfo, error) {
	return a.tagHandler.GetAllTags()
}

func (a *App) GetTagColors() map[string]string {
	return a.tagHandler.GetTagColors()
}

func (a *App) SetTagColor(tagName string, color string) error {
	return a.tagHandler.SetTagColor(tagName, color)
}

func (a *App) PinTag(tagName string) error {
	return a.tagHandler.PinTag(tagName)
}

func (a *App) UnpinTag(tagName string) error {
	return a.tagHandler.UnpinTag(tagName)
}

func (a *App) SetPinnedTagCollapsed(name string, collapsed bool) error {
	return a.tagHandler.SetPinnedTagCollapsed(name, collapsed)
}

func (a *App) GetPinnedTags() []handlers.TagInfo {
	return a.tagHandler.GetPinnedTags()
}

func (a *App) ReorderPinnedTags(names []string) error {
	return a.tagHandler.ReorderPinnedTags(names)
}

func (a *App) RenameTag(oldName, newName string) error {
	return a.tagHandler.RenameTag(oldName, newName)
}

func (a *App) DeleteTag(name string) error {
	return a.tagHandler.DeleteTag(name)
}

// ========== 文件 API (委托给 FileHandler) ==========

func (a *App) ImportMarkdownFile() (*markdown.ImportResult, error) {
	return a.fileHandler.ImportMarkdownFile()
}

func (a *App) ExportMarkdownFile(content string, defaultName string) error {
	return a.fileHandler.ExportMarkdownFile(content, defaultName)
}

func (a *App) ExportHTMLFile(content string, defaultName string) error {
	return a.fileHandler.ExportHTMLFile(content, defaultName)
}

func (a *App) OpenExternalFile() (handlers.ExternalFile, error) {
	return a.fileHandler.OpenExternalFile()
}

func (a *App) SaveExternalFile(path string, content string) error {
	return a.fileHandler.SaveExternalFile(path, content)
}

func (a *App) LoadExternalFile(path string) (string, error) {
	return a.fileHandler.LoadExternalFile(path)
}

func (a *App) CopyImageToClipboard(base64Data string) error {
	return a.fileHandler.CopyImageToClipboard(base64Data)
}

func (a *App) SaveImage(base64Data string, filename string) (string, error) {
	return a.fileHandler.SaveImage(base64Data, filename)
}

func (a *App) SaveImageFile(base64Data string, defaultName string) error {
	return a.fileHandler.SaveImageFile(base64Data, defaultName)
}

func (a *App) PrintHTML(htmlContent string, title string) error {
	return a.fileHandler.PrintHTML(htmlContent, title)
}

func (a *App) FetchLinkMetadata(url string) (*opengraph.LinkMetadata, error) {
	return a.fileHandler.FetchLinkMetadata(url)
}

// ========== MCP API ==========

// MCPInfo MCP 配置信息
type MCPInfo struct {
	BinaryPath string `json:"binaryPath"`
	ConfigJSON string `json:"configJson"`
}

// GetMCPInfo 获取 MCP 二进制路径和配置示例
func (a *App) GetMCPInfo() MCPInfo {
	// 获取可执行文件路径
	execPath, err := os.Executable()
	if err != nil {
		return MCPInfo{}
	}

	// 根据平台确定 MCP 二进制路径
	execDir := filepath.Dir(execPath)
	var mcpPath string

	// macOS: MCP 在 .app/Contents/Resources/nook-mcp
	// Windows/Linux: MCP 与主程序同目录
	if strings.HasSuffix(execDir, "Contents/MacOS") {
		// macOS .app 包结构
		appContents := filepath.Dir(execDir)
		mcpPath = filepath.Join(appContents, "Resources", "nook-mcp")
	} else {
		mcpPath = filepath.Join(execDir, "nook-mcp")
	}

	// 生成 Claude Code 配置示例
	configJSON := `{
  "mcpServers": {
    "nook": {
      "command": "` + mcpPath + `",
      "args": []
    }
  }
}`

	return MCPInfo{
		BinaryPath: mcpPath,
		ConfigJSON: configJSON,
	}
}

// GetOS returns the current operating system
func (a *App) GetOS() string {
	return stdruntime.GOOS
}
