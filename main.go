package main

import (
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

	"notion-lite/internal/constant"
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
	_, _ = w.Write(data) // 忽略写入错误
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

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

	// Create application with options
	// Windows下隐藏菜单栏 (保留macOS菜单)
	var finalMenu *menu.Menu = nil
	if goruntime.GOOS == "darwin" {
		finalMenu = AppMenu
	}

	err := wails.Run(&options.App{
		Title:     constant.AppTitle,
		Width:     1200,
		Height:    800,
		Frameless: true,
		Menu:      finalMenu,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: NewImageHandler(),
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
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
