package rag

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// EmbeddingServiceError 嵌入服务错误（包含 HTTP 状态码，用于判断是否可恢复）
type EmbeddingServiceError struct {
	Provider   string
	StatusCode int
	Message    string
}

func (e *EmbeddingServiceError) Error() string {
	return e.Message
}

// IsUnrecoverable 判断是否是不可恢复的错误（5xx 服务端错误，以及 401/403/404 配置错误）
func (e *EmbeddingServiceError) IsUnrecoverable() bool {
	return e.StatusCode >= 500 || e.StatusCode == 404 || e.StatusCode == 401 || e.StatusCode == 403 || e.StatusCode == -1
}

// IsEmbeddingServiceError 检查错误是否是 EmbeddingServiceError 并返回
func IsEmbeddingServiceError(err error) (*EmbeddingServiceError, bool) {
	var serviceErr *EmbeddingServiceError
	if errors.As(err, &serviceErr) {
		return serviceErr, true
	}
	return nil, false
}

// EmbeddingClient 嵌入向量生成接口
type EmbeddingClient interface {
	Embed(text string) ([]float32, error)
	EmbedBatch(texts []string) ([][]float32, error)
	Dimension() int
	// DetectDimension 通过实际嵌入检测维度（用于未知模型）
	DetectDimension() (int, error)
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

// TestConnectionResult 连接测试结果
type TestConnectionResult struct {
	Success   bool   `json:"success"`
	Dimension int    `json:"dimension"`
	Error     string `json:"error,omitempty"`
}

// TestConnection 测试嵌入服务连接
func TestConnection(config *EmbeddingConfig) TestConnectionResult {
	client, err := NewEmbeddingClient(config)
	if err != nil {
		return TestConnectionResult{Success: false, Error: err.Error()}
	}

	dim, err := client.DetectDimension()
	if err != nil {
		return TestConnectionResult{Success: false, Error: err.Error()}
	}

	return TestConnectionResult{Success: true, Dimension: dim}
}

// ========== Ollama 实现 ==========

// OllamaClient Ollama 嵌入客户端
type OllamaClient struct {
	baseURL     string
	model       string
	client      *http.Client
	detectedDim int
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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, &EmbeddingServiceError{
			Provider:   "ollama",
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("ollama returned status %d", resp.StatusCode),
		}
	}

	var result struct {
		Embedding []float32 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// JSON 解析失败通常意味着返回了 HTML 或其他非预期格式（例如错误的端点返回 200 OK）
		// 这种情况下我们也视为不可恢复的配置错误
		return nil, &EmbeddingServiceError{
			Provider:   "ollama",
			StatusCode: -1, // 特殊状态码表示格式错误
			Message:    fmt.Sprintf("failed to decode response: %v", err),
		}
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

// Dimension 返回已检测的向量维度
func (c *OllamaClient) Dimension() int {
	return c.detectedDim
}

// DetectDimension 通过实际嵌入检测维度
func (c *OllamaClient) DetectDimension() (int, error) {
	vec, err := c.Embed("test")
	if err != nil {
		return 0, err
	}
	c.detectedDim = len(vec)
	return c.detectedDim, nil
}

// ========== OpenAI 兼容实现 ==========

// OpenAIClient OpenAI 兼容嵌入客户端
type OpenAIClient struct {
	baseURL     string
	model       string
	apiKey      string
	client      *http.Client
	detectedDim int
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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, &EmbeddingServiceError{
			Provider:   "openai",
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("openai returned status %d", resp.StatusCode),
		}
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, &EmbeddingServiceError{
			Provider:   "openai",
			StatusCode: -1,
			Message:    fmt.Sprintf("failed to decode response: %v", err),
		}
	}

	embeddings := make([][]float32, len(result.Data))
	for i, d := range result.Data {
		embeddings[i] = d.Embedding
	}
	return embeddings, nil
}

// Dimension 返回已检测的向量维度
func (c *OpenAIClient) Dimension() int {
	return c.detectedDim
}

// DetectDimension 通过实际嵌入检测维度
func (c *OpenAIClient) DetectDimension() (int, error) {
	vec, err := c.Embed("test")
	if err != nil {
		return 0, err
	}
	c.detectedDim = len(vec)
	return c.detectedDim, nil
}
