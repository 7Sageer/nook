package main

import (
	"context"
	"os"
	"path/filepath"
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
	folderRepo      *folder.Repository
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
	os.MkdirAll(dataPath, 0755)
	os.MkdirAll(filepath.Join(dataPath, "documents"), 0755)

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
		folderRepo:      folderRepo,
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
	app.tagHandler = handlers.NewTagHandler(dataPath, docRepo, tagStore, watcherService)
	app.fileHandler = handlers.NewFileHandler(nil, dataPath, markdownService)

	return app
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.markdownService.SetContext(ctx)
	a.fileHandler.SetContext(ctx)

	// 一次性迁移：将文件夹转换为标签组
	a.migrateFoldersToTagGroups()

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

// migrateFoldersToTagGroups 将文件夹迁移为标签组（一次性）
func (a *App) migrateFoldersToTagGroups() {
	foldersPath := filepath.Join(a.dataPath, "folders.json")

	if _, err := os.Stat(foldersPath); os.IsNotExist(err) {
		return
	}

	folders, err := a.folderRepo.GetAll()
	if err != nil || len(folders) == 0 {
		return
	}

	index, err := a.docRepo.GetAll()
	if err != nil {
		return
	}

	folderNameByID := make(map[string]string)
	for _, f := range folders {
		folderNameByID[f.ID] = f.Name
		a.tagStore.CreateGroup(f.Name)
		if f.Collapsed {
			a.tagStore.SetGroupCollapsed(f.Name, true)
		}
	}

	for _, doc := range index.Documents {
		if doc.FolderId != "" {
			if folderName, ok := folderNameByID[doc.FolderId]; ok {
				a.docRepo.AddTag(doc.ID, folderName)
				a.docRepo.MoveToFolder(doc.ID, "")
			}
		}
	}

	groupNames := make([]string, len(folders))
	for i, f := range folders {
		groupNames[i] = f.Name
	}
	a.tagStore.ReorderGroups(groupNames)

	backupPath := foldersPath + ".bak"
	os.Rename(foldersPath, backupPath)
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

func (a *App) SearchDocuments(query string) ([]SearchResult, error) {
	results, err := a.searchHandler.SearchDocuments(query)
	if err != nil {
		return nil, err
	}
	out := make([]SearchResult, len(results))
	for i, r := range results {
		out[i] = SearchResult{ID: r.ID, Title: r.Title, Snippet: r.Snippet}
	}
	return out, nil
}

func (a *App) SemanticSearch(query string, limit int) ([]SemanticSearchResult, error) {
	results, err := a.searchHandler.SemanticSearch(query, limit)
	if err != nil {
		return nil, err
	}
	out := make([]SemanticSearchResult, len(results))
	for i, r := range results {
		out[i] = SemanticSearchResult{
			DocID: r.DocID, DocTitle: r.DocTitle, BlockID: r.BlockID,
			Content: r.Content, BlockType: r.BlockType, Score: r.Score,
		}
	}
	return out, nil
}

func (a *App) SemanticSearchDocuments(query string, limit int) ([]DocumentSearchResult, error) {
	results, err := a.searchHandler.SemanticSearchDocuments(query, limit)
	if err != nil {
		return nil, err
	}
	out := make([]DocumentSearchResult, len(results))
	for i, r := range results {
		chunks := make([]ChunkMatch, len(r.MatchedChunks))
		for j, c := range r.MatchedChunks {
			chunks[j] = ChunkMatch{
				BlockID: c.BlockID, Content: c.Content, BlockType: c.BlockType,
				HeadingContext: c.HeadingContext, Score: c.Score,
			}
		}
		out[i] = DocumentSearchResult{
			DocID: r.DocID, DocTitle: r.DocTitle, MaxScore: r.MaxScore, MatchedChunks: chunks,
		}
	}
	return out, nil
}

// ========== RAG API (委托给 RAGHandler) ==========

func (a *App) GetRAGConfig() (EmbeddingConfig, error) {
	cfg, err := a.ragHandler.GetRAGConfig()
	if err != nil {
		return EmbeddingConfig{}, err
	}
	return EmbeddingConfig{
		Provider: cfg.Provider, BaseURL: cfg.BaseURL, Model: cfg.Model,
		APIKey: cfg.APIKey, MaxChunkSize: cfg.MaxChunkSize, Overlap: cfg.Overlap,
	}, nil
}

func (a *App) SaveRAGConfig(config EmbeddingConfig) error {
	return a.ragHandler.SaveRAGConfig(handlers.EmbeddingConfig{
		Provider: config.Provider, BaseURL: config.BaseURL, Model: config.Model,
		APIKey: config.APIKey, MaxChunkSize: config.MaxChunkSize, Overlap: config.Overlap,
	})
}

func (a *App) GetRAGStatus() RAGStatus {
	s := a.ragHandler.GetRAGStatus()
	return RAGStatus{
		Enabled: s.Enabled, IndexedDocs: s.IndexedDocs, TotalDocs: s.TotalDocs, LastIndexTime: s.LastIndexTime,
	}
}

func (a *App) RebuildIndex() (int, error) {
	return a.ragHandler.RebuildIndex()
}

// IndexBookmarkContent 索引书签网页内容
func (a *App) IndexBookmarkContent(url, sourceDocID, blockID string) error {
	return a.ragHandler.IndexBookmarkContent(url, sourceDocID, blockID)
}

// ========== 设置 API (委托给 SettingsHandler) ==========

func (a *App) GetSettings() (Settings, error) {
	s, err := a.settingsHandler.GetSettings()
	if err != nil {
		return Settings{Theme: "light", Language: "zh", SidebarWidth: 0}, nil
	}
	return Settings{Theme: s.Theme, Language: s.Language, SidebarWidth: s.SidebarWidth}, nil
}

func (a *App) SaveSettings(s Settings) error {
	return a.settingsHandler.SaveSettings(handlers.Settings{
		Theme: s.Theme, Language: s.Language, SidebarWidth: s.SidebarWidth,
	})
}

// ========== 标签 API (委托给 TagHandler) ==========

func (a *App) AddDocumentTag(docId string, tagName string) error {
	return a.tagHandler.AddDocumentTag(docId, tagName)
}

func (a *App) RemoveDocumentTag(docId string, tagName string) error {
	return a.tagHandler.RemoveDocumentTag(docId, tagName)
}

func (a *App) GetAllTags() ([]TagInfo, error) {
	tags, err := a.tagHandler.GetAllTags()
	if err != nil {
		return nil, err
	}
	out := make([]TagInfo, len(tags))
	for i, t := range tags {
		out[i] = TagInfo{
			Name: t.Name, Count: t.Count, Color: t.Color,
			IsGroup: t.IsGroup, Collapsed: t.Collapsed, Order: t.Order,
		}
	}
	return out, nil
}

func (a *App) GetTagColors() map[string]string {
	return a.tagHandler.GetTagColors()
}

func (a *App) SetTagColor(tagName string, color string) error {
	return a.tagHandler.SetTagColor(tagName, color)
}

func (a *App) CreateTagGroup(name string) error {
	return a.tagHandler.CreateTagGroup(name)
}

func (a *App) SetTagGroupCollapsed(name string, collapsed bool) error {
	return a.tagHandler.SetTagGroupCollapsed(name, collapsed)
}

func (a *App) GetTagGroups() []TagInfo {
	groups := a.tagHandler.GetTagGroups()
	out := make([]TagInfo, len(groups))
	for i, g := range groups {
		out[i] = TagInfo{
			Name: g.Name, Count: g.Count, Color: g.Color,
			IsGroup: g.IsGroup, Collapsed: g.Collapsed, Order: g.Order,
		}
	}
	return out
}

func (a *App) ReorderTagGroups(names []string) error {
	return a.tagHandler.ReorderTagGroups(names)
}

func (a *App) RenameTagGroup(oldName, newName string) error {
	return a.tagHandler.RenameTagGroup(oldName, newName)
}

func (a *App) DeleteTagGroup(name string) error {
	return a.tagHandler.DeleteTagGroup(name)
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

func (a *App) OpenExternalFile() (ExternalFile, error) {
	f, err := a.fileHandler.OpenExternalFile()
	if err != nil {
		return ExternalFile{}, err
	}
	return ExternalFile{Path: f.Path, Name: f.Name, Content: f.Content}, nil
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
