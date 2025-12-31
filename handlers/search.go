package handlers

import (
	"fmt"

	"notion-lite/internal/document"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
)

// SearchHandler 搜索处理器
type SearchHandler struct {
	docRepo       *document.Repository
	searchService *search.Service
	ragService    *rag.Service
}

// NewSearchHandler 创建搜索处理器
func NewSearchHandler(
	docRepo *document.Repository,
	searchService *search.Service,
	ragService *rag.Service,
) *SearchHandler {
	return &SearchHandler{
		docRepo:       docRepo,
		searchService: searchService,
		ragService:    ragService,
	}
}

// SearchResult 搜索结果
type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// SemanticSearchResult 语义搜索结果（Chunk 级别）
type SemanticSearchResult struct {
	DocID     string  `json:"docId"`
	DocTitle  string  `json:"docTitle"`
	BlockID   string  `json:"blockId"`
	Content   string  `json:"content"`
	BlockType string  `json:"blockType"`
	Score     float32 `json:"score"`
}

// ChunkMatch 匹配的 chunk 信息
type ChunkMatch struct {
	BlockID        string  `json:"blockId"`
	SourceBlockId  string  `json:"sourceBlockId,omitempty"` // 原始 BlockNote block ID（用于定位）
	Content        string  `json:"content"`
	BlockType      string  `json:"blockType"`
	HeadingContext string  `json:"headingContext"`
	Score          float32 `json:"score"`
}

// DocumentSearchResult 文档级搜索结果
type DocumentSearchResult struct {
	DocID         string       `json:"docId"`
	DocTitle      string       `json:"docTitle"`
	MaxScore      float32      `json:"maxScore"`
	MatchedChunks []ChunkMatch `json:"matchedChunks"`
}

// SearchDocuments 搜索文档
func (h *SearchHandler) SearchDocuments(query string) ([]SearchResult, error) {
	results, err := h.searchService.Search(query)
	if err != nil {
		return nil, err
	}
	// 转换为前端兼容的类型
	searchResults := make([]SearchResult, len(results))
	for i, r := range results {
		searchResults[i] = SearchResult{
			ID:      r.ID,
			Title:   r.Title,
			Snippet: r.Snippet,
		}
	}
	return searchResults, nil
}

// SemanticSearch 语义搜索
func (h *SearchHandler) SemanticSearch(query string, limit int) ([]SemanticSearchResult, error) {
	if h.ragService == nil {
		return nil, fmt.Errorf("RAG service not initialized")
	}
	// 默认限制 10 条
	if limit <= 0 {
		limit = 10
	}
	results, err := h.ragService.Search(query, limit)
	if err != nil {
		return nil, err
	}

	// 转换为前端兼容的类型
	output := make([]SemanticSearchResult, len(results))
	for i, r := range results {
		output[i] = SemanticSearchResult{
			DocID:     r.DocID,
			DocTitle:  r.DocTitle,
			BlockID:   r.BlockID,
			Content:   r.Content,
			BlockType: r.BlockType,
			Score:     r.Score,
		}
	}
	return output, nil
}

// SemanticSearchDocuments 文档级语义搜索（聚合 chunks）
func (h *SearchHandler) SemanticSearchDocuments(query string, limit int) ([]DocumentSearchResult, error) {
	if h.ragService == nil {
		return nil, fmt.Errorf("RAG service not initialized")
	}
	// 默认限制 10 条
	if limit <= 0 {
		limit = 10
	}
	results, err := h.ragService.SearchDocuments(query, limit)
	if err != nil {
		return nil, err
	}

	// 转换为前端兼容的类型
	output := make([]DocumentSearchResult, len(results))
	for i, r := range results {
		chunks := make([]ChunkMatch, len(r.MatchedChunks))
		for j, c := range r.MatchedChunks {
			chunks[j] = ChunkMatch{
				BlockID:        c.BlockID,
				SourceBlockId:  c.SourceBlockId,
				Content:        c.Content,
				BlockType:      c.BlockType,
				HeadingContext: c.HeadingContext,
				Score:          c.Score,
			}
		}
		output[i] = DocumentSearchResult{
			DocID:         r.DocID,
			DocTitle:      r.DocTitle,
			MaxScore:      r.MaxScore,
			MatchedChunks: chunks,
		}
	}
	return output, nil
}
