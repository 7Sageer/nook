package rag

import (
	"notion-lite/internal/document"
	"sort"
)

// SemanticSearchResult 搜索结果（包含文档标题）- Chunk 级别
type SemanticSearchResult struct {
	DocID     string  `json:"docId"`
	DocTitle  string  `json:"docTitle"`
	BlockID   string  `json:"blockId"`
	Content   string  `json:"content"`
	BlockType string  `json:"blockType"`
	Score     float32 `json:"score"` // 相似度分数 (0-1)
}

// ChunkMatch 匹配的 chunk 信息
type ChunkMatch struct {
	BlockID        string  `json:"blockId"`
	Content        string  `json:"content"`
	BlockType      string  `json:"blockType"`
	HeadingContext string  `json:"headingContext"`
	Score          float32 `json:"score"`
}

// DocumentSearchResult 文档级搜索结果
type DocumentSearchResult struct {
	DocID         string       `json:"docId"`
	DocTitle      string       `json:"docTitle"`
	MaxScore      float32      `json:"maxScore"`      // 最高相关性分数
	MatchedChunks []ChunkMatch `json:"matchedChunks"` // 匹配的 chunks（按分数排序）
}

// Searcher 语义搜索器
type Searcher struct {
	store    *VectorStore
	embedder EmbeddingClient
	docRepo  *document.Repository
}

// NewSearcher 创建搜索器
func NewSearcher(store *VectorStore, embedder EmbeddingClient, docRepo *document.Repository) *Searcher {
	return &Searcher{
		store:    store,
		embedder: embedder,
		docRepo:  docRepo,
	}
}

// Search 执行语义搜索（Chunk 级别）
func (s *Searcher) Search(query string, limit int) ([]SemanticSearchResult, error) {
	// 1. 生成查询向量
	queryVec, err := s.embedder.Embed(query)
	if err != nil {
		return nil, err
	}

	// 2. 向量搜索
	results, err := s.store.Search(queryVec, limit)
	if err != nil {
		return nil, err
	}

	// 3. 补充文档标题
	index, _ := s.docRepo.GetAll()
	titleMap := make(map[string]string)
	for _, doc := range index.Documents {
		titleMap[doc.ID] = doc.Title
	}

	output := make([]SemanticSearchResult, len(results))
	for i, r := range results {
		output[i] = SemanticSearchResult{
			DocID:     r.DocID,
			DocTitle:  titleMap[r.DocID],
			BlockID:   r.BlockID,
			Content:   r.Content,
			BlockType: r.BlockType,
			Score:     1 - r.Distance, // 距离转相似度
		}
	}
	return output, nil
}

// SearchDocuments 执行文档级语义搜索（聚合 chunks）
func (s *Searcher) SearchDocuments(query string, limit int) ([]DocumentSearchResult, error) {
	// 1. 生成查询向量
	queryVec, err := s.embedder.Embed(query)
	if err != nil {
		return nil, err
	}

	// 2. 扩大召回量以确保覆盖更多文档
	expandedLimit := limit * 5
	if expandedLimit < 20 {
		expandedLimit = 20
	}

	results, err := s.store.Search(queryVec, expandedLimit)
	if err != nil {
		return nil, err
	}

	// 3. 获取文档标题映射
	index, _ := s.docRepo.GetAll()
	titleMap := make(map[string]string)
	for _, doc := range index.Documents {
		titleMap[doc.ID] = doc.Title
	}

	// 4. 按 DocID 聚合 chunks
	docMap := make(map[string]*DocumentSearchResult)
	for _, r := range results {
		score := 1 - r.Distance // 距离转相似度

		chunk := ChunkMatch{
			BlockID:        r.BlockID,
			Content:        r.Content,
			BlockType:      r.BlockType,
			HeadingContext: r.HeadingContext,
			Score:          score,
		}

		if doc, exists := docMap[r.DocID]; exists {
			doc.MatchedChunks = append(doc.MatchedChunks, chunk)
			if score > doc.MaxScore {
				doc.MaxScore = score
			}
		} else {
			docMap[r.DocID] = &DocumentSearchResult{
				DocID:         r.DocID,
				DocTitle:      titleMap[r.DocID],
				MaxScore:      score,
				MatchedChunks: []ChunkMatch{chunk},
			}
		}
	}

	// 5. 转换为切片并按 MaxScore 排序
	output := make([]DocumentSearchResult, 0, len(docMap))
	for _, doc := range docMap {
		// 对每个文档内的 chunks 按分数排序
		sort.Slice(doc.MatchedChunks, func(i, j int) bool {
			return doc.MatchedChunks[i].Score > doc.MatchedChunks[j].Score
		})
		// 限制每个文档最多返回 3 个 chunks
		if len(doc.MatchedChunks) > 3 {
			doc.MatchedChunks = doc.MatchedChunks[:3]
		}
		output = append(output, *doc)
	}

	// 按 MaxScore 降序排序
	sort.Slice(output, func(i, j int) bool {
		return output[i].MaxScore > output[j].MaxScore
	})

	// 限制返回数量
	if len(output) > limit {
		output = output[:limit]
	}

	return output, nil
}
