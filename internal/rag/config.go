package rag

import (
	"encoding/json"
	"os"

	"notion-lite/internal/utils"
)

// EmbeddingConfig 嵌入模型配置
type EmbeddingConfig struct {
	Provider     string `json:"provider"`     // "ollama" | "openai"
	BaseURL      string `json:"baseUrl"`      // API 地址
	Model        string `json:"model"`        // 模型名称
	APIKey       string `json:"apiKey"`       // API 密钥（OpenAI 需要）
	MaxChunkSize int    `json:"maxChunkSize"` // 长块分割阈值，默认 800
	Overlap      int    `json:"overlap"`      // 重叠字符数，默认 100
}

// DefaultConfig 默认配置（Ollama 本地）
var DefaultConfig = EmbeddingConfig{
	Provider:     "ollama",
	BaseURL:      "http://localhost:11434",
	Model:        "nomic-embed-text",
	MaxChunkSize: 800,
	Overlap:      100,
}

// GetChunkConfig 获取分块配置
func (c *EmbeddingConfig) GetChunkConfig() ChunkConfig {
	maxSize := c.MaxChunkSize
	if maxSize <= 0 {
		maxSize = DefaultChunkConfig.MaxChunkSize
	}
	overlap := c.Overlap
	if overlap <= 0 {
		overlap = DefaultChunkConfig.Overlap
	}
	return ChunkConfig{
		MaxChunkSize: maxSize,
		Overlap:      overlap,
	}
}

// LoadConfig 从文件加载配置
func LoadConfig(paths *utils.PathBuilder) (*EmbeddingConfig, error) {
	path := paths.RAGConfig()
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
func SaveConfig(paths *utils.PathBuilder, config *EmbeddingConfig) error {
	path := paths.RAGConfig()
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
