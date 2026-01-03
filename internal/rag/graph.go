package rag

import (
	"math"
)

// GraphNode 图谱节点
type GraphNode struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Val   int    `json:"val"` // 节点大小（基于块数量）
}

// GraphLink 图谱边
type GraphLink struct {
	Source     string  `json:"source"`
	Target     string  `json:"target"`
	Similarity float32 `json:"similarity"`
}

// GraphData 图谱完整数据
type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

// GetDocumentGraph 获取文档关系图谱
// threshold: 相似度阈值 (0-1)，低于此值的边不显示
func (s *Service) GetDocumentGraph(threshold float32) (*GraphData, error) {
	if err := s.init(); err != nil {
		return nil, err
	}

	// 1. 获取所有文档列表
	index, err := s.docRepo.GetAll()
	if err != nil {
		return nil, err
	}

	// 2. 获取每个文档的代表性向量（平均向量）
	docVectors := make(map[string][]float32)
	docBlockCounts := make(map[string]int)

	for _, doc := range index.Documents {
		vec, count, err := s.getDocumentAverageVector(doc.ID)
		if err != nil || vec == nil {
			continue // 跳过没有向量的文档
		}
		docVectors[doc.ID] = vec
		docBlockCounts[doc.ID] = count
	}

	// 3. 构建节点列表
	nodes := make([]GraphNode, 0, len(docVectors))
	docTitles := make(map[string]string)
	for _, doc := range index.Documents {
		if _, exists := docVectors[doc.ID]; exists {
			docTitles[doc.ID] = doc.Title
			nodes = append(nodes, GraphNode{
				ID:    doc.ID,
				Title: doc.Title,
				Val:   docBlockCounts[doc.ID],
			})
		}
	}

	// 4. 计算两两相似度，构建边
	links := make([]GraphLink, 0)
	docIDs := make([]string, 0, len(docVectors))
	for id := range docVectors {
		docIDs = append(docIDs, id)
	}

	for i := 0; i < len(docIDs); i++ {
		for j := i + 1; j < len(docIDs); j++ {
			similarity := cosineSimilarity(docVectors[docIDs[i]], docVectors[docIDs[j]])
			if similarity >= threshold {
				links = append(links, GraphLink{
					Source:     docIDs[i],
					Target:     docIDs[j],
					Similarity: similarity,
				})
			}
		}
	}

	return &GraphData{
		Nodes: nodes,
		Links: links,
	}, nil
}

// getDocumentAverageVector 获取文档的平均向量
func (s *Service) getDocumentAverageVector(docID string) ([]float32, int, error) {
	vectors, err := s.store.GetDocumentVectors(docID)
	if err != nil || len(vectors) == 0 {
		return nil, 0, err
	}

	// 计算平均向量
	dim := len(vectors[0])
	avgVec := make([]float32, dim)
	for _, vec := range vectors {
		for i := 0; i < dim; i++ {
			avgVec[i] += vec[i]
		}
	}
	for i := 0; i < dim; i++ {
		avgVec[i] /= float32(len(vectors))
	}

	return avgVec, len(vectors), nil
}

// cosineSimilarity 计算两个向量的余弦相似度
func cosineSimilarity(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return float32(dotProduct / (math.Sqrt(normA) * math.Sqrt(normB)))
}
