package settings

import (
	"encoding/json"
	"os"

	"notion-lite/internal/utils"
)

// Settings 用户设置
type Settings struct {
	Theme        string `json:"theme"`
	Language     string `json:"language"`
	SidebarWidth int    `json:"sidebarWidth"` // 侧边栏宽度, 0 表示默认值
}

// Service 设置服务
// Service 设置服务
type Service struct {
	paths *utils.PathBuilder
}

// NewService 创建设置服务
// NewService 创建设置服务
func NewService(paths *utils.PathBuilder) *Service {
	return &Service{paths: paths}
}

// Get 获取设置
func (s *Service) Get() (*Settings, error) {
	path := s.paths.Settings()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Settings{Theme: "light", Language: "zh"}, nil
		}
		return nil, err
	}
	var settings Settings
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, err
	}
	return &settings, nil
}

// Save 保存设置
// Save 保存设置
func (s *Service) Save(settings Settings) error {
	path := s.paths.Settings()
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
