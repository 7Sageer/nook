package rag

import (
	"database/sql"
	"unsafe"
)

// Upsert 插入或更新块向量
func (s *VectorStore) Upsert(block *BlockVector) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 更新元数据（包含 content_hash, heading_context, source_block_id 和 file_path）
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO block_vectors (id, doc_id, content, content_hash, block_type, heading_context, source_block_id, file_path)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, block.ID, block.DocID, block.Content, block.ContentHash, block.BlockType, block.HeadingContext, block.SourceBlockID, block.FilePath)
	if err != nil {
		return err
	}

	// 更新向量（sqlite-vec 虚拟表不支持 INSERT OR REPLACE，需要先删除再插入）
	vecBytes := serializeVector(block.Embedding)
	_, _ = tx.Exec(`DELETE FROM vec_blocks WHERE id = ?`, block.ID)
	_, err = tx.Exec(`INSERT INTO vec_blocks (id, embedding) VALUES (?, ?)`, block.ID, vecBytes)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetBlockHashes 获取文档所有块的哈希映射
func (s *VectorStore) GetBlockHashes(docID string) (map[string]string, error) {
	rows, err := s.db.Query(`SELECT id, content_hash FROM block_vectors WHERE doc_id = ?`, docID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	hashes := make(map[string]string)
	for rows.Next() {
		var id string
		var hash sql.NullString
		if err := rows.Scan(&id, &hash); err != nil {
			return nil, err
		}
		if hash.Valid {
			hashes[id] = hash.String
		}
	}
	return hashes, nil
}

// DeleteBlocks 删除指定的块
func (s *VectorStore) DeleteBlocks(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, id := range ids {
		_, _ = tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
		_, _ = tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
	}

	return tx.Commit()
}

// DeleteBlocksByPrefix 删除指定前缀的所有块
func (s *VectorStore) DeleteBlocksByPrefix(prefix string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 获取匹配前缀的所有块 ID
	rows, err := tx.Query(`SELECT id FROM block_vectors WHERE id LIKE ?`, prefix+"%")
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue // 跳过扫描失败的行
		}
		ids = append(ids, id)
	}
	if err := rows.Close(); err != nil {
		_ = tx.Rollback()
		return err
	}

	// 删除向量和元数据
	for _, id := range ids {
		_, _ = tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
		_, _ = tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
	}

	return tx.Commit()
}

// DeleteByDocID 删除文档的所有块向量
func (s *VectorStore) DeleteByDocID(docID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 获取要删除的 block IDs
	rows, err := tx.Query("SELECT id FROM block_vectors WHERE doc_id = ?", docID)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue // 跳过扫描失败的行
		}
		ids = append(ids, id)
	}
	if err := rows.Close(); err != nil {
		_ = tx.Rollback()
		return err
	}

	// 删除向量和元数据
	for _, id := range ids {
		_, _ = tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
		_, _ = tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
	}

	return tx.Commit()
}

// GetAllDocIDs 获取所有已索引的文档 ID
func (s *VectorStore) GetAllDocIDs() ([]string, error) {
	rows, err := s.db.Query(`SELECT DISTINCT doc_id FROM block_vectors`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var docIDs []string
	for rows.Next() {
		var docID string
		if err := rows.Scan(&docID); err != nil {
			return nil, err
		}
		docIDs = append(docIDs, docID)
	}
	return docIDs, nil
}

// GetDocumentVectors 获取文档的所有向量嵌入
func (s *VectorStore) GetDocumentVectors(docID string) ([][]float32, error) {
	// 获取该文档的所有块 ID
	rows, err := s.db.Query(`SELECT id FROM block_vectors WHERE doc_id = ?`, docID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var blockIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		blockIDs = append(blockIDs, id)
	}

	if len(blockIDs) == 0 {
		return nil, nil
	}

	// 从 vec_blocks 获取每个块的向量
	vectors := make([][]float32, 0, len(blockIDs))
	for _, id := range blockIDs {
		vec, err := s.getVectorByID(id)
		if err != nil {
			continue // 跳过获取失败的向量
		}
		if vec != nil {
			vectors = append(vectors, vec)
		}
	}

	return vectors, nil
}

// getVectorByID 根据 ID 获取向量（从 vec_blocks 虚拟表）
func (s *VectorStore) getVectorByID(id string) ([]float32, error) {
	row := s.db.QueryRow(`SELECT embedding FROM vec_blocks WHERE id = ?`, id)

	var vecBytes []byte
	if err := row.Scan(&vecBytes); err != nil {
		return nil, err
	}

	// 反序列化向量
	return deserializeVector(vecBytes, s.dimension), nil
}

// deserializeVector 将字节反序列化为 float32 切片
func deserializeVector(buf []byte, dimension int) []float32 {
	if len(buf) != dimension*4 {
		return nil
	}
	vec := make([]float32, dimension)
	for i := 0; i < dimension; i++ {
		bits := uint32(buf[i*4]) | uint32(buf[i*4+1])<<8 | uint32(buf[i*4+2])<<16 | uint32(buf[i*4+3])<<24
		vec[i] = float32frombits(bits)
	}
	return vec
}

// float32frombits 将 uint32 转换为 float32（等价于 math.Float32frombits）
func float32frombits(b uint32) float32 {
	return *(*float32)(unsafe.Pointer(&b))
}
