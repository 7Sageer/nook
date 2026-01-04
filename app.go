package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	stdruntime "runtime"
	"strings"
	"sync"
	"time"

	"notion-lite/handlers"
	"notion-lite/internal/constant"
	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"notion-lite/internal/markdown"
	"notion-lite/internal/opengraph"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/settings"
	"notion-lite/internal/tag"
	"notion-lite/internal/utils"
	"notion-lite/internal/watcher"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx   context.Context
	paths *utils.PathBuilder

	// Services needed for startup/shutdown logic
	markdownService *markdown.Service
	watcherService  *watcher.Service

	// Handlers (the API boundary for Wails bindings)
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
	paths := utils.NewPathBuilder(dataPath)

	_ = os.MkdirAll(paths.DataPath(), 0755)     // 忽略错误
	_ = os.MkdirAll(paths.DocumentsDir(), 0755) // 忽略错误

	// Create all services
	docRepo := document.NewRepository(paths)
	docStorage := document.NewStorage(paths)
	folderRepo := folder.NewRepository(paths)
	searchService := search.NewService(docRepo, docStorage)
	settingsService := settings.NewService(paths)
	markdownService := markdown.NewService()
	tagStore := tag.NewStore(paths)
	ragService := rag.NewService(paths, docRepo, docStorage)
	tagService := tag.NewService(docRepo, tagStore, folderRepo, &ragAdapter{ragService})

	// 创建文件监听服务
	watcherService, err := watcher.NewService(paths)
	if err != nil {
		watcherService = nil
	}

	app := &App{
		paths:           paths,
		markdownService: markdownService,
		watcherService:  watcherService,
	}

	// 创建 BaseHandler（共享给所有 handlers）
	baseHandler := handlers.NewBaseHandler(paths, watcherService)

	// 初始化 Handlers (services are injected but not stored in App)
	app.documentHandler = handlers.NewDocumentHandler(
		baseHandler, docRepo, docStorage, searchService, ragService,
	)
	app.searchHandler = handlers.NewSearchHandler(baseHandler, docRepo, searchService, ragService)
	app.ragHandler = handlers.NewRAGHandler(baseHandler, docRepo, ragService)
	app.settingsHandler = handlers.NewSettingsHandler(baseHandler, settingsService)
	app.tagHandler = handlers.NewTagHandler(baseHandler, tagService)
	app.fileHandler = handlers.NewFileHandler(baseHandler, markdownService)

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
	// Delegate file change handling to DocumentHandler
	a.documentHandler.SetupFileWatcher(a.documentHandler.OnExternalFileChange)

	if a.watcherService != nil {
		if err := a.watcherService.Start(ctx); err != nil {
			runtime.LogError(ctx, "Failed to start file watcher: "+err.Error())
		}
	}

	// 注册拖拽处理回调
	runtime.OnFileDrop(ctx, a.handleFileDrop)

	runtime.EventsOn(ctx, "app:frontend-ready", func(_ ...interface{}) {
		a.pendingExternalOpensMu.Lock()
		a.frontendReady = true
		a.pendingExternalOpensMu.Unlock()
		a.flushPendingExternalFileOpens()
	})

	// 异步构建搜索索引
	a.searchHandler.BuildSearchIndex()
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

// handleFileDrop 处理文件/文件夹拖拽
func (a *App) handleFileDrop(x, y int, paths []string) {
	if len(paths) == 0 {
		return
	}

	path := ""
	for _, candidate := range paths {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" {
			path = candidate
			break
		}
	}
	if path == "" {
		return
	}

	info, err := os.Stat(path)
	if err != nil {
		runtime.LogError(a.ctx, constant.LogFailedToStatDroppedPath+err.Error())
		return
	}

	if info.IsDir() {
		// 文件夹：发送 folder:dropped 事件
		runtime.EventsEmit(a.ctx, "folder:dropped", map[string]interface{}{
			"path": path,
			"name": filepath.Base(path),
		})
	} else {
		// 文件：发送 file:dropped 事件
		runtime.EventsEmit(a.ctx, "file:dropped", map[string]interface{}{
			"path":     path,
			"name":     filepath.Base(path),
			"size":     info.Size(),
			"mimeType": getMimeType(path),
		})
	}
}

// getMimeType 根据文件扩展名获取 MIME 类型
func getMimeType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".md":
		return "text/markdown"
	case ".txt":
		return "text/plain"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".html", ".htm":
		return "text/html"
	default:
		return "application/octet-stream"
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

func (a *App) SemanticSearchDocuments(query string, limit int, excludeDocID string) ([]handlers.DocumentSearchResult, error) {
	return a.searchHandler.SemanticSearchDocuments(query, limit, excludeDocID)
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

// GetDocumentGraph 获取文档关系图谱
func (a *App) GetDocumentGraph(threshold float32) (*handlers.GraphData, error) {
	return a.ragHandler.GetDocumentGraph(threshold)
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

// CopyFileToStorage 从源路径复制文件到存储目录（用于拖拽上传）
func (a *App) CopyFileToStorage(sourcePath string) (*handlers.FileInfo, error) {
	return a.fileHandler.CopyFileToStorage(sourcePath)
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

// IndexFolderContent 索引文件夹内容
func (a *App) IndexFolderContent(folderPath, sourceDocID, blockID string) (*handlers.FolderIndexResult, error) {
	return a.ragHandler.IndexFolderContent(folderPath, sourceDocID, blockID)
}

// SelectFolderDialog 文件夹选择对话框
func (a *App) SelectFolderDialog() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder to Index",
	})
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

func (a *App) SuggestTags(docId string) ([]handlers.TagSuggestion, error) {
	return a.tagHandler.SuggestTags(docId)
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

// ========== App Info API ==========

// AppInfo 应用信息
type AppInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Author    string `json:"author"`
	Copyright string `json:"copyright"`
}

// GetAppInfo 获取应用信息
func (a *App) GetAppInfo() AppInfo {
	return AppInfo{
		Name:      "Nook",
		Version:   Version, // 从编译时注入的版本号读取
		Author:    "7Sageer",
		Copyright: "© 2025-2026 7Sageer",
	}
}

// UpdateInfo 更新信息
type UpdateInfo struct {
	HasUpdate      bool   `json:"hasUpdate"`
	LatestVersion  string `json:"latestVersion"`
	CurrentVersion string `json:"currentVersion"`
	ReleaseNotes   string `json:"releaseNotes"`
	ReleaseURL     string `json:"releaseURL"`
	PublishedAt    string `json:"publishedAt"`
}

// GitHubRelease GitHub 发布信息结构
type GitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
	Prerelease  bool   `json:"prerelease"`
	Draft       bool   `json:"draft"`
}

// CheckForUpdates 检查更新
func (a *App) CheckForUpdates() (UpdateInfo, error) {
	// 如果是开发版本，不检查更新
	if Version == "dev" {
		return UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
			LatestVersion:  Version,
		}, nil
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get("https://api.github.com/repos/7Sageer/nook/releases/latest")
	if err != nil {
		return UpdateInfo{CurrentVersion: Version}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return UpdateInfo{CurrentVersion: Version}, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return UpdateInfo{CurrentVersion: Version}, err
	}

	var release GitHubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return UpdateInfo{CurrentVersion: Version}, err
	}

	// 简单的版本比较：如果 tag_name 与当前版本不同，且不是 dev，则认为有更新
	// 注意：GitHub tag 通常带有 'v' 前缀，通过 strings.TrimPrefix 去除比较
	latestVer := strings.TrimPrefix(release.TagName, "v")
	currentVer := strings.TrimPrefix(Version, "v")

	hasUpdate := latestVer != currentVer

	return UpdateInfo{
		HasUpdate:      hasUpdate,
		LatestVersion:  release.TagName,
		CurrentVersion: Version,
		ReleaseNotes:   release.Body,
		ReleaseURL:     release.HTMLURL,
		PublishedAt:    release.PublishedAt,
	}, nil
}

// ========== RAG Adapter for Tag Service ==========

// ragAdapter 适配器，让 rag.Service 实现 tag.RAGSearcher 接口
type ragAdapter struct {
	ragService *rag.Service
}

// SearchSimilarDocuments 实现 tag.RAGSearcher 接口
func (a *ragAdapter) SearchSimilarDocuments(docId string, limit int) ([]tag.RAGDocumentResult, error) {
	results, err := a.ragService.SearchSimilarDocuments(docId, limit)
	if err != nil {
		return nil, err
	}
	// 转换结果类型
	tagResults := make([]tag.RAGDocumentResult, len(results))
	for i, r := range results {
		tagResults[i] = tag.RAGDocumentResult{DocID: r.DocID}
	}
	return tagResults, nil
}
