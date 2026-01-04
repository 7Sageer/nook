package handlers

import (
	"notion-lite/internal/document"
	"notion-lite/internal/errors"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/utils"
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

// ChunkMatch 匹配的 chunk 信息
type ChunkMatch struct {
	BlockID        string  `json:"blockId"`
	SourceBlockId  string  `json:"sourceBlockId,omitempty"` // 原始 BlockNote block ID（用于定位）
	SourceType     string  `json:"sourceType"`              // 节点类型: "document", "bookmark", "file", "folder"
	SourceTitle    string  `json:"sourceTitle,omitempty"`   // 来源标题（书签标题/文件名）
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
	// 使用泛型转换为前端兼容的类型
	return utils.ConvertSlice(results, func(r search.Result) SearchResult {
		return SearchResult{
			ID:      r.ID,
			Title:   r.Title,
			Snippet: r.Snippet,
		}
	}), nil
}

// SemanticSearchDocuments 文档级语义搜索（聚合 chunks）
func (h *SearchHandler) SemanticSearchDocuments(query string, limit int, excludeDocID string) ([]DocumentSearchResult, error) {
	if h.ragService == nil {
		return nil, errors.New("RAG service not initialized")
	}
	// 默认限制 10 条
	if limit <= 0 {
		limit = 10
	}
	results, err := h.ragService.SearchDocuments(query, limit, excludeDocID)
	if err != nil {
		return nil, err
	}

	// 使用泛型转换为前端兼容的类型
	return utils.ConvertSlice(results, func(r rag.DocumentSearchResult) DocumentSearchResult {
		return DocumentSearchResult{
			DocID:    r.DocID,
			DocTitle: r.DocTitle,
			MaxScore: r.MaxScore,
			MatchedChunks: utils.ConvertSlice(r.MatchedChunks, func(c rag.ChunkMatch) ChunkMatch {
				return ChunkMatch{
					BlockID:        c.BlockID,
					SourceBlockId:  c.SourceBlockId,
					SourceType:     c.SourceType,
					SourceTitle:    c.SourceTitle,
					Content:        c.Content,
					BlockType:      c.BlockType,
					HeadingContext: c.HeadingContext,
					Score:          c.Score,
				}
			}),
		}
	}), nil
}

// BuildSearchIndex 异步构建搜索索引（由 app.startup 调用）
func (h *SearchHandler) BuildSearchIndex() {
	go h.searchService.BuildIndex()
}
