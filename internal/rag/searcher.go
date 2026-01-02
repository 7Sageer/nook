package rag

import (
	"notion-lite/internal/document"
	"regexp"
	"sort"
	"strings"
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
			SourceBlockId:  getSourceBlockId(r),
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

// FindRelatedDocuments 根据内容片段查找相关文档（chunk → doc 推荐）
// content: 当前选中的内容/块文本
// limit: 返回的文档数量上限
// excludeDocID: 排除的文档 ID（当前文档，避免推荐自己）
func (s *Searcher) FindRelatedDocuments(content string, limit int, excludeDocID string) ([]DocumentSearchResult, error) {
	// 1. 生成内容向量
	contentVec, err := s.embedder.Embed(content)
	if err != nil {
		return nil, err
	}

	// 2. 扩大召回量以确保覆盖更多文档（因为要排除当前文档）
	expandedLimit := limit * 8
	if expandedLimit < 30 {
		expandedLimit = 30
	}

	results, err := s.store.Search(contentVec, expandedLimit)
	if err != nil {
		return nil, err
	}

	// 3. 获取文档标题映射
	index, _ := s.docRepo.GetAll()
	titleMap := make(map[string]string)
	for _, doc := range index.Documents {
		titleMap[doc.ID] = doc.Title
	}

	// 4. 按 DocID 聚合 chunks，排除当前文档
	docMap := make(map[string]*DocumentSearchResult)
	for _, r := range results {
		// 排除当前文档
		if r.DocID == excludeDocID {
			continue
		}

		score := 1 - r.Distance // 距离转相似度

		chunk := ChunkMatch{
			BlockID:        r.BlockID,
			SourceBlockId:  getSourceBlockId(r),
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

// uuidPattern 匹配 UUID 格式（支持大小写）
var uuidPattern = regexp.MustCompile(`(?i)[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}`)

// parseSourceBlockId 从存储的 blockId 解析出原始的 BlockNote block ID
// 支持的格式：
// - 普通块：{blockId} 或 {blockId}_chunk_N
// - Bookmark：{docId}_{blockId}_bookmark 或 {docId}_{blockId}_bookmark_chunk_N
// - File：{docId}_{blockId}_file 或 {docId}_{blockId}_file_chunk_N
// - 聚合块：agg_xxx（无法定位，返回空）
func parseSourceBlockId(blockId string) string {
	// 聚合块无法定位到原始块
	if strings.HasPrefix(blockId, "agg_") {
		return ""
	}

	// 移除 _chunk_N 后缀
	id := blockId
	if idx := strings.Index(id, "_chunk_"); idx != -1 {
		id = id[:idx]
	}

	// 处理 bookmark 格式：{docId}_{blockId}_bookmark
	if strings.HasSuffix(id, "_bookmark") {
		id = strings.TrimSuffix(id, "_bookmark")
		// 提取两个 UUID，第二个是原始 blockId
		uuids := uuidPattern.FindAllString(id, -1)
		if len(uuids) >= 2 {
			return uuids[1]
		}
		return ""
	}

	// 处理 file 格式：{docId}_{blockId}_file
	if strings.HasSuffix(id, "_file") {
		id = strings.TrimSuffix(id, "_file")
		// 提取两个 UUID，第二个是原始 blockId
		uuids := uuidPattern.FindAllString(id, -1)
		if len(uuids) >= 2 {
			return uuids[1]
		}
		return ""
	}

	// 普通块：直接返回（可能是原始 UUID）
	if uuidPattern.MatchString(id) {
		return id
	}

	return ""
}

// getSourceBlockId 获取原始块 ID 用于定位
// 优先使用数据库存储的 SourceBlockID，如果为空则回退到解析
func getSourceBlockId(r SearchResult) string {
	// 优先使用直接存储的 SourceBlockID
	if r.SourceBlockID != "" {
		return r.SourceBlockID
	}
	// 回退到解析（兼容旧数据）
	return parseSourceBlockId(r.BlockID)
}
