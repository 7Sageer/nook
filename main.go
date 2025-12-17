package main

import (
	"embed"
	goruntime "runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

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
	FileMenu := AppMenu.AddSubmenu("文件")
	FileMenu.AddText("新建文档", keys.CmdOrCtrl("n"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:new-document")
	})
	FileMenu.AddText("打开文件", keys.Combo("o", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:open-external")
	})
	FileMenu.AddSeparator()
	FileMenu.AddText("导入 Markdown", keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:import")
	})
	FileMenu.AddText("导出 Markdown", keys.Combo("e", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:export")
	})

	// Add Edit menu (required on macOS for Cmd+C, Cmd+V, Cmd+Z shortcuts)
	if goruntime.GOOS == "darwin" {
		AppMenu.Append(menu.EditMenu())
	}

	// Add View menu
	ViewMenu := AppMenu.AddSubmenu("视图")
	ViewMenu.AddText("切换侧边栏", keys.CmdOrCtrl("b"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:toggle-sidebar")
	})
	ViewMenu.AddText("切换深色模式", keys.CmdOrCtrl("d"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:toggle-theme")
	})

	// Add Help menu
	HelpMenu := AppMenu.AddSubmenu("帮助")
	HelpMenu.AddText("关于 Nostalgia", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.ctx, "menu:about")
	})

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Nostalgia",
		Width:  1024,
		Height: 768,
		Menu:   AppMenu,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
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
