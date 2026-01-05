package settings

import (
	"notion-lite/internal/repository"
	"notion-lite/internal/utils"
)

// Settings 用户设置
type Settings struct {
	Theme        string `json:"theme"`
	Language     string `json:"language"`
	SidebarWidth int    `json:"sidebarWidth"` // 侧边栏宽度, 0 表示默认值
	WritingStyle string `json:"writingStyle"` // 写作风格指南
}

// Service 设置服务
type Service struct {
	repository.BaseRepository
	paths *utils.PathBuilder
}

// NewService 创建设置服务
func NewService(paths *utils.PathBuilder) *Service {
	return &Service{paths: paths}
}

// Get 获取设置
func (s *Service) Get() (*Settings, error) {
	path := s.paths.Settings()
	var settings Settings
	err := s.LoadJSON(path, &settings)
	if err != nil {
		return &Settings{Theme: "light", Language: "zh"}, nil
	}
	if settings.Theme == "" {
		return &Settings{Theme: "light", Language: "zh"}, nil
	}
	return &settings, nil
}

// Save 保存设置
func (s *Service) Save(settings Settings) error {
	path := s.paths.Settings()
	return s.SaveJSON(path, settings)
}
