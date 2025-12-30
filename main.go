package main

import (
	"context"
	"embed"
	"net/http"
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"notion-lite/handlers"
	"notion-lite/internal/constant"
	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"notion-lite/internal/markdown"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/settings"
	"notion-lite/internal/tag"
	"notion-lite/internal/watcher"
)

//go:embed all:frontend/dist
var assets embed.FS

// ImageHandler 处理本地图片请求
type ImageHandler struct {
	imagesDir string
}

func NewImageHandler() *ImageHandler {
	homeDir, _ := os.UserHomeDir()
	return &ImageHandler{
		imagesDir: filepath.Join(homeDir, ".Nook", "images"),
	}
}

func (h *ImageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 只处理 /images/ 路径
	if !strings.HasPrefix(r.URL.Path, "/images/") {
		http.NotFound(w, r)
		return
	}

	filename := strings.TrimPrefix(r.URL.Path, "/images/")
	filePath := filepath.Join(h.imagesDir, filename)

	// 安全检查：防止路径遍历攻击
	if !strings.HasPrefix(filepath.Clean(filePath), h.imagesDir) {
		http.NotFound(w, r)
		return
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// 设置 Content-Type
	contentType := "application/octet-stream"
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".gif":
		contentType = "image/gif"
	case ".webp":
		contentType = "image/webp"
	case ".svg":
		contentType = "image/svg+xml"
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(data)
}

func main() {
	// 1. 初始化数据路径
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".Nook")
	os.MkdirAll(dataPath, 0755)
	os.MkdirAll(filepath.Join(dataPath, "documents"), 0755)

	// 2. 初始化所有 Service
	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)
	folderRepo := folder.NewRepository(dataPath)
	searchService := search.NewService(docRepo, docStorage)
	settingsService := settings.NewService(dataPath)
	markdownService := markdown.NewService()
	tagStore := tag.NewStore(dataPath)
	ragService := rag.NewService(dataPath, docRepo, docStorage)

	watcherService, err := watcher.NewService(dataPath)
	if err != nil {
		// Log error but continue? or set to nil
		watcherService = nil
	}

	// 3. 初始化所有 Handlers

	// 定义清理函数闭包
	cleanupImagesFunc := func() {
		CleanupUnusedImages(dataPath, docRepo, docStorage)
	}

	docHandler := handlers.NewDocumentHandler(
		dataPath, docRepo, docStorage, searchService, ragService, watcherService, cleanupImagesFunc,
	)
	searchHandler := handlers.NewSearchHandler(docRepo, searchService, ragService)
	ragHandler := handlers.NewRAGHandler(dataPath, docRepo, ragService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	tagHandler := handlers.NewTagHandler(dataPath, docRepo, tagStore, watcherService)

	// FileHandler 需要 context，稍后设置
	fileHandler := handlers.NewFileHandler(context.Background(), dataPath, markdownService)

	// 4. 初始化主应用 (Lifecycle & Menu Events)
	// 注意：NewApp 签名需要修改为接受这些依赖
	app := NewApp(
		dataPath,
		docRepo,
		docStorage,
		folderRepo,
		tagStore,
		searchService,
		watcherService,
		markdownService,
		fileHandler,
	)

	// Create application menu
	AppMenu := menu.NewMenu()

	// On macOS, must add AppMenu first (shows app name in top-left)
	if goruntime.GOOS == "darwin" {
		AppMenu.Append(menu.AppMenu())
	}

	// Add File menu
	FileMenu := AppMenu.AddSubmenu(constant.MenuFile)
	FileMenu.AddText(constant.MenuFileNewDoc, keys.CmdOrCtrl("n"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:new-document")
	})
	FileMenu.AddText(constant.MenuFileNewFolder, keys.Combo("n", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:new-folder")
	})
	FileMenu.AddText(constant.MenuFileOpen, keys.Combo("o", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:open-external")
	})
	FileMenu.AddSeparator()
	FileMenu.AddText(constant.MenuFileImport, keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:import")
	})
	FileMenu.AddText(constant.MenuFileExport, keys.Combo("e", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:export")
	})
	FileMenu.AddText(constant.MenuFileExportImg, keys.Combo("c", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:copy-image")
	})
	FileMenu.AddText(constant.MenuFileSaveImg, keys.Combo("i", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:save-image")
	})
	FileMenu.AddText(constant.MenuFileExportHTML, keys.Combo("h", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:export-html")
	})
	FileMenu.AddSeparator()
	FileMenu.AddText(constant.MenuFilePrint, keys.CmdOrCtrl("p"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:print")
	})

	// Add Edit menu (required on macOS for Cmd+C, Cmd+V, Cmd+Z shortcuts)
	if goruntime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
	}

	// Add View menu
	ViewMenu := AppMenu.AddSubmenu(constant.MenuView)
	ViewMenu.AddText(constant.MenuViewToggleSidebar, keys.CmdOrCtrl("\\"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:toggle-sidebar")
	})
	ViewMenu.AddText(constant.MenuViewToggleTheme, keys.CmdOrCtrl("d"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:toggle-theme")
	})

	// Add Help menu
	HelpMenu := AppMenu.AddSubmenu(constant.MenuHelp)
	HelpMenu.AddText(constant.MenuHelpAbout, nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:about")
	})

	// Add Settings menu item (macOS standard: in app menu, but we add to View for cross-platform)
	ViewMenu.AddSeparator()
	ViewMenu.AddText(constant.MenuSettings, keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:settings")
	})

	// 5. 启动 Wails 应用
	err = wails.Run(&options.App{
		Title:  constant.AppTitle,
		Width:  1200,
		Height: 800,
		Menu:   AppMenu,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: NewImageHandler(),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			fileHandler.SetContext(ctx) // Update context for FileHandler
		},
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app, // Lifecycle methods
			docHandler,
			searchHandler,
			ragHandler,
			settingsHandler,
			tagHandler,
			fileHandler,
		},
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarHiddenInset(),
			Appearance: mac.DefaultAppearance, // 跟随系统主题
			OnFileOpen: func(filePath string) {
				// 当用户通过 Finder 双击文件打开应用时触发
				app.handleExternalFileOpen(filePath)
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
