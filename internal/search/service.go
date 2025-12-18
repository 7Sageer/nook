package search

import (
	"strings"

	"notion-lite/internal/document"
	"notion-lite/internal/constant"
)

// Result 搜索结果
type Result struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// Service 搜索服务
type Service struct {
	repo    *document.Repository
	storage *document.Storage
}

// NewService 创建搜索服务
func NewService(repo *document.Repository, storage *document.Storage) *Service {
	return &Service{
		repo:    repo,
		storage: storage,
	}
}

// Search 搜索文档
func (s *Service) Search(query string) ([]Result, error) {
	if query == "" {
		return []Result{}, nil
	}

	query = strings.ToLower(query)
	index, err := s.repo.GetAll()
	if err != nil {
		return nil, err
	}
	results := []Result{}

	for _, doc := range index.Documents {
		// 搜索标题
		if strings.Contains(strings.ToLower(doc.Title), query) {
			results = append(results, Result{
				ID:      doc.ID,
				Title:   doc.Title,
				Snippet: constant.SearchTitleMatch,
			})
			continue
		}

		// 搜索内容 - 忽略单个文档加载错误，继续搜索其他文档
		content, err := s.storage.Load(doc.ID)
		if err != nil {
			continue
		}
		if strings.Contains(strings.ToLower(content), query) {
			snippet := extractSnippet(content, query)
			results = append(results, Result{
				ID:      doc.ID,
				Title:   doc.Title,
				Snippet: snippet,
			})
		}
	}

	return results, nil
}

func extractSnippet(content string, query string) string {
	lowerContent := strings.ToLower(content)
	idx := strings.Index(lowerContent, strings.ToLower(query))
	if idx == -1 {
		return ""
	}
	start := idx - 20
	if start < 0 {
		start = 0
	}
	end := idx + len(query) + 30
	if end > len(content) {
		end = len(content)
	}
	snippet := content[start:end]
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(content) {
		snippet = snippet + "..."
	}
	return snippet
}
