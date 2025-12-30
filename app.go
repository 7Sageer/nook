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
	"notion-lite/internal/search"
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
	tagStore        *tag.Store
	searchService   *search.Service
	watcherService  *watcher.Service
	markdownService *markdown.Service
	fileHandler     *handlers.FileHandler

	pendingExternalOpensMu sync.Mutex
	pendingExternalOpens   []string
	frontendReady          bool
}

// NewApp creates a new App application struct
func NewApp(
	dataPath string,
	docRepo *document.Repository,
	docStorage *document.Storage,
	folderRepo *folder.Repository,
	tagStore *tag.Store,
	searchService *search.Service,
	watcherService *watcher.Service,
	markdownService *markdown.Service,
	fileHandler *handlers.FileHandler,
) *App {
	return &App{
		dataPath:        dataPath,
		docRepo:         docRepo,
		docStorage:      docStorage,
		folderRepo:      folderRepo,
		tagStore:        tagStore,
		searchService:   searchService,
		watcherService:  watcherService,
		markdownService: markdownService,
		fileHandler:     fileHandler,
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.markdownService.SetContext(ctx)
	// a.fileHandler.SetContext(ctx) is now called in main.go OnStartup

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

// Cleanup 执行所有清理任务
func (a *App) Cleanup() {
	CleanupUnusedImages(a.dataPath, a.docRepo, a.docStorage)
	CleanupTempFiles(a.dataPath)
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
