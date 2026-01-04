package rag

import (
	"fmt"
	"strings"
)

// Search 向量相似度搜索（支持过滤条件）
func (s *VectorStore) Search(queryVec []float32, limit int, filter *SearchFilter) ([]SearchResult, error) {
	vecBytes := serializeVector(queryVec)

	// 构建动态 WHERE 条件
	var conditions []string
	var args []interface{}
	args = append(args, vecBytes, limit)

	if filter != nil {
		if filter.DocID != "" {
			conditions = append(conditions, "b.doc_id = ?")
			args = append(args, filter.DocID)
		}
		if filter.SourceBlockID != "" {
			conditions = append(conditions, "b.source_block_id = ?")
			args = append(args, filter.SourceBlockID)
		}
		if filter.ExcludeDocID != "" {
			conditions = append(conditions, "b.doc_id != ?")
			args = append(args, filter.ExcludeDocID)
		}
	}

	// 构建 SQL 查询
	query := `
		SELECT v.id, v.distance, b.doc_id, b.content, b.block_type,
			COALESCE(b.heading_context, ''), COALESCE(b.source_block_id, ''),
			COALESCE(b.source_type, 'document'), COALESCE(e.title, '')
		FROM vec_blocks v
		JOIN block_vectors b ON v.id = b.id
		LEFT JOIN external_block_content e ON b.doc_id = e.doc_id AND b.source_block_id = e.block_id
		WHERE v.embedding MATCH ? AND k = ?`

	if len(conditions) > 0 {
		query += " AND " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY v.distance"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.BlockID, &r.Distance, &r.DocID, &r.Content, &r.BlockType, &r.HeadingContext, &r.SourceBlockID, &r.SourceType, &r.SourceTitle); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}
