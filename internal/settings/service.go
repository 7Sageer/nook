package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Settings 用户设置
type Settings struct {
	Theme        string `json:"theme"`
	Language     string `json:"language"`
	SidebarWidth int    `json:"sidebarWidth"` // 侧边栏宽度, 0 表示默认值
}

// Service 设置服务
type Service struct {
	dataPath string
}

// NewService 创建设置服务
func NewService(dataPath string) *Service {
	return &Service{dataPath: dataPath}
}

// Get 获取设置
func (s *Service) Get() (*Settings, error) {
	path := filepath.Join(s.dataPath, "settings.json")
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
func (s *Service) Save(settings Settings) error {
	path := filepath.Join(s.dataPath, "settings.json")
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
