package rag

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// EmbeddingClient 嵌入向量生成接口
type EmbeddingClient interface {
	Embed(text string) ([]float32, error)
	EmbedBatch(texts []string) ([][]float32, error)
	Dimension() int
}

// NewEmbeddingClient 根据配置创建客户端
func NewEmbeddingClient(config *EmbeddingConfig) (EmbeddingClient, error) {
	switch config.Provider {
	case "ollama":
		return NewOllamaClient(config.BaseURL, config.Model), nil
	case "openai":
		return NewOpenAIClient(config.BaseURL, config.Model, config.APIKey), nil
	default:
		return nil, fmt.Errorf("unknown provider: %s", config.Provider)
	}
}

// ========== Ollama 实现 ==========

// OllamaClient Ollama 嵌入客户端
type OllamaClient struct {
	baseURL string
	model   string
	client  *http.Client
}

// NewOllamaClient 创建 Ollama 客户端
func NewOllamaClient(baseURL, model string) *OllamaClient {
	return &OllamaClient{
		baseURL: baseURL,
		model:   model,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Embed 生成单个文本的嵌入向量
func (c *OllamaClient) Embed(text string) ([]float32, error) {
	reqBody := map[string]interface{}{
		"model":  c.model,
		"prompt": text,
	}
	body, _ := json.Marshal(reqBody)

	resp, err := c.client.Post(
		c.baseURL+"/api/embeddings",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("ollama request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var result struct {
		Embedding []float32 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return result.Embedding, nil
}

// EmbedBatch 批量生成嵌入向量（Ollama 不支持批量，逐个处理）
func (c *OllamaClient) EmbedBatch(texts []string) ([][]float32, error) {
	results := make([][]float32, len(texts))
	for i, text := range texts {
		emb, err := c.Embed(text)
		if err != nil {
			return nil, err
		}
		results[i] = emb
	}
	return results, nil
}

// Dimension 返回向量维度
func (c *OllamaClient) Dimension() int {
	// 根据模型返回对应的向量维度
	switch c.model {
	case "bge-m3":
		return 1024
	case "mxbai-embed-large":
		return 1024
	case "nomic-embed-text":
		return 768
	case "all-minilm":
		return 384
	case "snowflake-arctic-embed":
		return 1024
	default:
		return 768 // 默认维度
	}
}

// ========== OpenAI 兼容实现 ==========

// OpenAIClient OpenAI 兼容嵌入客户端
type OpenAIClient struct {
	baseURL string
	model   string
	apiKey  string
	client  *http.Client
}

// NewOpenAIClient 创建 OpenAI 兼容客户端
func NewOpenAIClient(baseURL, model, apiKey string) *OpenAIClient {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &OpenAIClient{
		baseURL: baseURL,
		model:   model,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Embed 生成单个文本的嵌入向量
func (c *OpenAIClient) Embed(text string) ([]float32, error) {
	embeddings, err := c.EmbedBatch([]string{text})
	if err != nil {
		return nil, err
	}
	return embeddings[0], nil
}

// EmbedBatch 批量生成嵌入向量
func (c *OpenAIClient) EmbedBatch(texts []string) ([][]float32, error) {
	reqBody := map[string]interface{}{
		"model": c.model,
		"input": texts,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", c.baseURL+"/embeddings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai returned status %d", resp.StatusCode)
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	embeddings := make([][]float32, len(result.Data))
	for i, d := range result.Data {
		embeddings[i] = d.Embedding
	}
	return embeddings, nil
}

// Dimension 返回向量维度
func (c *OpenAIClient) Dimension() int {
	return 1536 // text-embedding-ada-002 默认维度
}
