package handlers

import (
	"notion-lite/internal/settings"
)

// SettingsHandler 设置处理器
type SettingsHandler struct {
	*BaseHandler
	settingsService *settings.Service
}

// NewSettingsHandler 创建设置处理器
func NewSettingsHandler(
	base *BaseHandler,
	settingsService *settings.Service,
) *SettingsHandler {
	return &SettingsHandler{
		BaseHandler:     base,
		settingsService: settingsService,
	}
}

// Settings 用户设置
type Settings struct {
	Theme        string `json:"theme"`
	Language     string `json:"language"`
	SidebarWidth int    `json:"sidebarWidth"`
}

// GetSettings 获取用户设置
func (h *SettingsHandler) GetSettings() (Settings, error) {
	s, err := h.settingsService.Get()
	if err != nil {
		return Settings{Theme: "light", Language: "zh", SidebarWidth: 0}, nil
	}
	return Settings{Theme: s.Theme, Language: s.Language, SidebarWidth: s.SidebarWidth}, nil
}

// SaveSettings 保存用户设置
func (h *SettingsHandler) SaveSettings(s Settings) error {
	return h.settingsService.Save(settings.Settings{Theme: s.Theme, Language: s.Language, SidebarWidth: s.SidebarWidth})
}
