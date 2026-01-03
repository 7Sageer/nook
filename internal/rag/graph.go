package rag

import (
	"math"
)

// GraphNode 图谱节点（支持多种类型：文档、书签、文件、文件夹）
type GraphNode struct {
	ID            string `json:"id"`
	Type          string `json:"type"` // "document", "bookmark", "file", "folder"
	Title         string `json:"title"`
	Val           int    `json:"val"`                     // 节点大小（基于块数量/内容量）
	ParentDocID   string `json:"parentDocId,omitempty"`   // 父文档 ID（仅 bookmark/file/folder）
	ParentBlockID string `json:"parentBlockId,omitempty"` // 父块 ID（用于跳转定位）
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

// GetDocumentGraph 获取文档关系图谱（包含所有知识节点：文档、书签、文件、文件夹）
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

	// 2. 收集所有节点的向量
	// nodeVectors: nodeID -> 平均向量
	// nodeInfos: nodeID -> GraphNode
	nodeVectors := make(map[string][]float32)
	nodeInfos := make(map[string]GraphNode)

	// 2.1 添加文档节点
	for _, doc := range index.Documents {
		vec, count, err := s.getDocumentAverageVector(doc.ID)
		if err != nil || vec == nil {
			continue
		}
		nodeID := "doc:" + doc.ID
		nodeVectors[nodeID] = vec
		nodeInfos[nodeID] = GraphNode{
			ID:    nodeID,
			Type:  "document",
			Title: doc.Title,
			Val:   count,
		}
	}

	// 2.2 添加外部块节点（bookmark/file/folder）
	externalNodes, err := s.store.GetAllExternalBlockNodes()
	if err == nil {
		for _, ext := range externalNodes {
			vec, count, err := s.getExternalBlockAverageVector(ext.DocID, ext.BlockID, ext.BlockType)
			if err != nil || vec == nil {
				continue
			}
			nodeID := ext.BlockType + ":" + ext.DocID + ":" + ext.BlockID
			nodeVectors[nodeID] = vec
			nodeInfos[nodeID] = GraphNode{
				ID:            nodeID,
				Type:          ext.BlockType,
				Title:         ext.Title,
				Val:           count,
				ParentDocID:   ext.DocID,
				ParentBlockID: ext.BlockID,
			}
		}
	}

	// 3. 转换为节点列表
	nodes := make([]GraphNode, 0, len(nodeInfos))
	for _, node := range nodeInfos {
		nodes = append(nodes, node)
	}

	// 4. 计算两两相似度，构建边
	links := make([]GraphLink, 0)
	nodeIDs := make([]string, 0, len(nodeVectors))
	for id := range nodeVectors {
		nodeIDs = append(nodeIDs, id)
	}

	for i := 0; i < len(nodeIDs); i++ {
		for j := i + 1; j < len(nodeIDs); j++ {
			similarity := cosineSimilarity(nodeVectors[nodeIDs[i]], nodeVectors[nodeIDs[j]])
			if similarity >= threshold {
				links = append(links, GraphLink{
					Source:     nodeIDs[i],
					Target:     nodeIDs[j],
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

// getDocumentAverageVector 获取文档的平均向量（只包含 source_type=document 的块）
func (s *Service) getDocumentAverageVector(docID string) ([]float32, int, error) {
	vectors, err := s.store.GetDocumentOnlyVectors(docID)
	if err != nil || len(vectors) == 0 {
		return nil, 0, err
	}

	return averageVectors(vectors), len(vectors), nil
}

// getExternalBlockAverageVector 获取外部块的平均向量
func (s *Service) getExternalBlockAverageVector(docID, blockID, blockType string) ([]float32, int, error) {
	vectors, err := s.store.GetExternalBlockVectors(docID, blockID, blockType)
	if err != nil || len(vectors) == 0 {
		return nil, 0, err
	}

	return averageVectors(vectors), len(vectors), nil
}

// averageVectors 计算多个向量的平均值
func averageVectors(vectors [][]float32) []float32 {
	if len(vectors) == 0 {
		return nil
	}
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
	return avgVec
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
