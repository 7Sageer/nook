package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Settings 用户设置
type Settings struct {
	Theme    string `json:"theme"`
	Language string `json:"language"`
}

// Service 设置服务
type Service struct {
	dataPath string
}

// NewService 创建设置服务
func NewService(dataPath string) *Service {
	return &Service{dataPath: dataPath}
}

// Get 获取用户设置
func (s *Service) Get() (Settings, error) {
	settingsPath := filepath.Join(s.dataPath, "settings.json")
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		return Settings{Theme: "light", Language: "zh"}, nil
	}
	var settings Settings
	json.Unmarshal(data, &settings)
	if settings.Theme == "" {
		settings.Theme = "light"
	}
	if settings.Language == "" {
		settings.Language = "zh"
	}
	return settings, nil
}

// Save 保存用户设置
func (s *Service) Save(settings Settings) error {
	settingsPath := filepath.Join(s.dataPath, "settings.json")
	data, _ := json.Marshal(settings)
	return os.WriteFile(settingsPath, data, 0644)
}
