package rag

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// EmbeddingConfig 嵌入模型配置
type EmbeddingConfig struct {
	Provider string `json:"provider"` // "ollama" | "openai"
	BaseURL  string `json:"baseUrl"`  // API 地址
	Model    string `json:"model"`    // 模型名称
	APIKey   string `json:"apiKey"`   // API 密钥（OpenAI 需要）
}

// DefaultConfig 默认配置（Ollama 本地）
var DefaultConfig = EmbeddingConfig{
	Provider: "ollama",
	BaseURL:  "http://localhost:11434",
	Model:    "nomic-embed-text",
}

// LoadConfig 从文件加载配置
func LoadConfig(dataDir string) (*EmbeddingConfig, error) {
	path := filepath.Join(dataDir, "rag_config.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// 返回默认配置的副本
			config := DefaultConfig
			return &config, nil
		}
		return nil, err
	}
	var config EmbeddingConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

// SaveConfig 保存配置到文件
func SaveConfig(dataDir string, config *EmbeddingConfig) error {
	path := filepath.Join(dataDir, "rag_config.json")
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
