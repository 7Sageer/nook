package handlers

import (
	"notion-lite/internal/document"
	"notion-lite/internal/rag"
)

// RAGHandler RAG 配置与索引处理器
type RAGHandler struct {
	dataPath   string
	docRepo    *document.Repository
	ragService *rag.Service
}

// NewRAGHandler 创建 RAG 处理器
func NewRAGHandler(
	dataPath string,
	docRepo *document.Repository,
	ragService *rag.Service,
) *RAGHandler {
	return &RAGHandler{
		dataPath:   dataPath,
		docRepo:    docRepo,
		ragService: ragService,
	}
}

// EmbeddingConfig 嵌入模型配置（前端用）
type EmbeddingConfig struct {
	Provider     string `json:"provider"`
	BaseURL      string `json:"baseUrl"`
	Model        string `json:"model"`
	APIKey       string `json:"apiKey"`
	MaxChunkSize int    `json:"maxChunkSize"`
	Overlap      int    `json:"overlap"`
}

// RAGStatus RAG 索引状态
type RAGStatus struct {
	Enabled       bool   `json:"enabled"`
	IndexedDocs   int    `json:"indexedDocs"`
	TotalDocs     int    `json:"totalDocs"`
	LastIndexTime string `json:"lastIndexTime"`
}

// GetRAGConfig 获取 RAG 配置
func (h *RAGHandler) GetRAGConfig() (EmbeddingConfig, error) {
	config, err := rag.LoadConfig(h.dataPath)
	if err != nil {
		return EmbeddingConfig{}, err
	}
	return EmbeddingConfig{
		Provider:     config.Provider,
		BaseURL:      config.BaseURL,
		Model:        config.Model,
		APIKey:       config.APIKey,
		MaxChunkSize: config.MaxChunkSize,
		Overlap:      config.Overlap,
	}, nil
}

// SaveRAGConfig 保存 RAG 配置
func (h *RAGHandler) SaveRAGConfig(config EmbeddingConfig) error {
	ragConfig := &rag.EmbeddingConfig{
		Provider:     config.Provider,
		BaseURL:      config.BaseURL,
		Model:        config.Model,
		APIKey:       config.APIKey,
		MaxChunkSize: config.MaxChunkSize,
		Overlap:      config.Overlap,
	}
	if err := rag.SaveConfig(h.dataPath, ragConfig); err != nil {
		return err
	}
	// 重新初始化 RAG 服务
	return h.ragService.Reinitialize()
}

// GetRAGStatus 获取 RAG 索引状态
func (h *RAGHandler) GetRAGStatus() RAGStatus {
	index, _ := h.docRepo.GetAll()
	totalDocs := len(index.Documents)

	indexedDocs, _ := h.ragService.GetIndexedCount()

	return RAGStatus{
		Enabled:       true,
		IndexedDocs:   indexedDocs,
		TotalDocs:     totalDocs,
		LastIndexTime: "",
	}
}

// RebuildIndex 重建 RAG 索引
func (h *RAGHandler) RebuildIndex() (int, error) {
	return h.ragService.ReindexAll()
}
