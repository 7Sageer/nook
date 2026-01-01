package rag

// Search 向量相似度搜索
func (s *VectorStore) Search(queryVec []float32, limit int) ([]SearchResult, error) {
	vecBytes := serializeVector(queryVec)
	rows, err := s.db.Query(`
		SELECT v.id, v.distance, b.doc_id, b.content, b.block_type, COALESCE(b.heading_context, ''), COALESCE(b.source_block_id, '')
		FROM vec_blocks v
		JOIN block_vectors b ON v.id = b.id
		WHERE v.embedding MATCH ? AND k = ?
		ORDER BY v.distance
	`, vecBytes, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []SearchResult
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.BlockID, &r.Distance, &r.DocID, &r.Content, &r.BlockType, &r.HeadingContext, &r.SourceBlockID); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}
