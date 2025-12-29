package search

import (
	"log"
	"strings"

	"notion-lite/internal/constant"
	"notion-lite/internal/document"
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
	index   *Index
}

// NewService 创建搜索服务
func NewService(repo *document.Repository, storage *document.Storage) *Service {
	return &Service{
		repo:    repo,
		storage: storage,
		index:   NewIndex(),
	}
}

// BuildIndex 构建索引 (启动时调用)
func (s *Service) BuildIndex() {
	index, err := s.repo.GetAll()
	if err != nil {
		log.Println("BuildIndex: failed to get document list:", err)
		return
	}

	for _, doc := range index.Documents {
		content, err := s.storage.Load(doc.ID)
		if err != nil {
			continue // 忽略加载失败的文档
		}
		s.index.Update(doc.ID, content)
	}
}

// UpdateIndex 更新单个文档索引
func (s *Service) UpdateIndex(docID string, content string) {
	s.index.Update(docID, content)
}

// RemoveIndex 移除文档索引
func (s *Service) RemoveIndex(docID string) {
	s.index.Remove(docID)
}

// Search 搜索文档
func (s *Service) Search(query string) ([]Result, error) {
	if query == "" {
		return []Result{}, nil
	}

	queryLower := strings.ToLower(query)
	indexDocs, err := s.repo.GetAll()
	if err != nil {
		return nil, err
	}

	results := []Result{}

	// 1. 获取内容匹配的 ID 列表 (从内存索引)
	contentMatches := s.index.Search(query)
	contentMatchMap := make(map[string]bool)
	for _, id := range contentMatches {
		contentMatchMap[id] = true
	}

	// 2. 遍历文档元数据，组合结果
	// (标题和标签匹配仍在遍历中做，因为它们很快且在 metadata 中)
	for _, doc := range indexDocs.Documents {
		// title match
		if strings.Contains(strings.ToLower(doc.Title), queryLower) {
			results = append(results, Result{
				ID:      doc.ID,
				Title:   doc.Title,
				Snippet: constant.SearchTitleMatch,
			})
			continue
		}

		// tag match
		tagMatch := false
		for _, tag := range doc.Tags {
			if strings.Contains(strings.ToLower(tag), queryLower) {
				results = append(results, Result{
					ID:      doc.ID,
					Title:   doc.Title,
					Snippet: "标签: " + tag,
				})
				tagMatch = true
				break
			}
		}
		if tagMatch {
			continue
		}

		// content match (check map)
		if contentMatchMap[doc.ID] {
			// 从索引缓存中获取纯文本来提取 snippet
			// 这样我们也不需要再次读取文件系统
			pureText := s.index.GetContent(doc.ID)
			snippet := extractSnippet(pureText, queryLower)
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
	// content 已经是 lowerCase 的纯文本 (from cache) ?
	// 不，GetContent 返回的应该是 lowerCase (我们在 indexer 里存的是 lower)
	// 但是 extractSnippet 最好还是展示原始文本...
	// 等等，indexer 里存的是 strings.ToLower(text)。
	// 这样 snippet 也会全是小写。
	// 为了展示效果友好，我们可能需要存一份 raw text，或者就在这里接受小写 snippet。
	// 考虑到搜索只是为了定位，小写 snippet 是可以接受的，但最好看。
	// 让我们修改 indexer.go 存两份？或者只存 raw，搜索时 lower。
	//
	// 这里为了简单，service.go 里的 extractSnippet 逻辑假设 content 是 raw。
	// 但 service.go: Matches return based on cache.
	// 让我们暂时接受 snippet 是小写的，或者修改 indexer.go。
	//
	// 为了性能，indexer 只存了一份 lower。
	// 如果要 snippet 正常大小写，我们需要 cache Raw Text。
	// 内存翻倍？
	// 100MB -> 200MB。 Still acceptable.
	// 让我们先用现有的 cache (lower) 看看效果。

	idx := strings.Index(content, query) // query is lower, content is lower
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
