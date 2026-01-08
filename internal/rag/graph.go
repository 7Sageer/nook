package rag

import (
	"math"
)

// GraphNode 图谱节点（支持多种类型：文档、书签、文件、文件夹）
type GraphNode struct {
	ID            string   `json:"id"`
	Type          string   `json:"type"` // "document", "bookmark", "file", "folder"
	Title         string   `json:"title"`
	Tags          []string `json:"tags,omitempty"`          // 标签列表
	Val           int      `json:"val"`                     // 节点大小（基于块数量/内容量）
	ParentDocID   string   `json:"parentDocId,omitempty"`   // 父文档 ID（仅 bookmark/file/folder）
	ParentBlockID string   `json:"parentBlockId,omitempty"` // 父块 ID（用于跳转定位）
}

// GraphLink 图谱边
type GraphLink struct {
	Source      string  `json:"source"`
	Target      string  `json:"target"`
	Similarity  float32 `json:"similarity"`
	HasSemantic bool    `json:"hasSemantic"` // 具有语义相似度（原本向量相似度 >= threshold）
	HasTags     bool    `json:"hasTags"`     // 具有相同标签
}

// GraphData 图谱完整数据
type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

// VectorGraphNode 带向量的节点（用于前端 UMAP 降维）
type VectorGraphNode struct {
	GraphNode
	Vector []float32 `json:"vector"` // 原始 embedding 平均向量
}

// VectorGraphData 带向量的图谱数据（用于前端降维可视化）
type VectorGraphData struct {
	Nodes []VectorGraphNode `json:"nodes"`
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
			// 即使没有向量（比如空文档），如果有标签，也应该显示在图谱中吗？
			// 目前逻辑是必须有向量才能计算相似度。
			// 如果我们想纯靠标签关联，那也需要节点存在。
			// 为了保持逻辑一致，暂时还是要求有内容（有向量）或者我们可以允许空向量但只由标签连接？
			// 简单起见，如果只依靠标签连接，我们可以在这里放宽限制，
			// 但余弦相似度需要向量。
			// 如果没有向量，我们暂时跳过（通常文档都有内容）。
			continue
		}
		nodeID := "doc:" + doc.ID
		nodeVectors[nodeID] = vec
		nodeInfos[nodeID] = GraphNode{
			ID:    nodeID,
			Type:  "document",
			Title: doc.Title,
			Tags:  doc.Tags,
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

	// 标签增强因子随 threshold 衰减：threshold 越高，标签影响越小
	tagFactor := float32(0.4) * (1.2 - threshold)

	for i := 0; i < len(nodeIDs); i++ {
		for j := i + 1; j < len(nodeIDs); j++ {
			idA := nodeIDs[i]
			idB := nodeIDs[j]

			// 基础向量相似度
			semanticSimilarity := cosineSimilarity(nodeVectors[idA], nodeVectors[idB])
			finalSimilarity := semanticSimilarity

			hasSemantic := semanticSimilarity >= threshold
			hasTags := false

			// 标签相似度增强 (仅文档之间，使用 Jaccard + 乘法增强)
			nodeA := nodeInfos[idA]
			nodeB := nodeInfos[idB]

			if nodeA.Type == "document" && nodeB.Type == "document" {
				commonTags := countCommonTags(nodeA.Tags, nodeB.Tags)
				if commonTags > 0 {
					// Jaccard 系数：共同标签数 / 并集标签数
					unionSize := len(nodeA.Tags) + len(nodeB.Tags) - commonTags
					jaccard := float32(commonTags) / float32(unionSize)
					// 乘法增强：标签只是放大已有的语义关联
					finalSimilarity = semanticSimilarity * (1 + jaccard*tagFactor)
					hasTags = true
				}
			}

			// 截断到 1.0
			if finalSimilarity > 1.0 {
				finalSimilarity = 1.0
			}

			if finalSimilarity >= threshold {
				links = append(links, GraphLink{
					Source:      idA,
					Target:      idB,
					Similarity:  finalSimilarity,
					HasSemantic: hasSemantic,
					HasTags:     hasTags,
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

// countCommonTags 计算两个标签列表的共同标签数
func countCommonTags(tagsA, tagsB []string) int {
	count := 0
	for _, tA := range tagsA {
		for _, tB := range tagsB {
			if tA == tB {
				count++
				break
			}
		}
	}
	return count
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

// GetDocumentVectors 获取所有节点及其向量（供前端 UMAP 降维使用）
func (s *Service) GetDocumentVectors() (*VectorGraphData, error) {
	if err := s.init(); err != nil {
		return nil, err
	}

	// 1. 获取所有文档列表
	index, err := s.docRepo.GetAll()
	if err != nil {
		return nil, err
	}

	nodes := make([]VectorGraphNode, 0)

	// 2. 添加文档节点
	for _, doc := range index.Documents {
		vec, count, err := s.getDocumentAverageVector(doc.ID)
		if err != nil || vec == nil {
			continue
		}
		nodeID := "doc:" + doc.ID
		nodes = append(nodes, VectorGraphNode{
			GraphNode: GraphNode{
				ID:    nodeID,
				Type:  "document",
				Title: doc.Title,
				Tags:  doc.Tags,
				Val:   count,
			},
			Vector: vec,
		})
	}

	// 3. 添加外部块节点（bookmark/file/folder）
	externalNodes, err := s.store.GetAllExternalBlockNodes()
	if err == nil {
		for _, ext := range externalNodes {
			vec, count, err := s.getExternalBlockAverageVector(ext.DocID, ext.BlockID, ext.BlockType)
			if err != nil || vec == nil {
				continue
			}
			nodeID := ext.BlockType + ":" + ext.DocID + ":" + ext.BlockID
			nodes = append(nodes, VectorGraphNode{
				GraphNode: GraphNode{
					ID:            nodeID,
					Type:          ext.BlockType,
					Title:         ext.Title,
					Val:           count,
					ParentDocID:   ext.DocID,
					ParentBlockID: ext.BlockID,
				},
				Vector: vec,
			})
		}
	}

	return &VectorGraphData{
		Nodes: nodes,
	}, nil
}
