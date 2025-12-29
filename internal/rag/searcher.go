package rag

import (
	"notion-lite/internal/document"
)

// SemanticSearchResult 搜索结果（包含文档标题）
type SemanticSearchResult struct {
	DocID     string  `json:"docId"`
	DocTitle  string  `json:"docTitle"`
	BlockID   string  `json:"blockId"`
	Content   string  `json:"content"`
	BlockType string  `json:"blockType"`
	Score     float32 `json:"score"` // 相似度分数 (0-1)
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

// Search 执行语义搜索
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
