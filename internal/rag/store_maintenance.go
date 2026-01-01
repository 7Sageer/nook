package rag

import (
	"fmt"
	"strings"
)

// GetBookmarkBlockIDs 获取文档的所有 bookmark 块 ID
func (s *VectorStore) GetBookmarkBlockIDs(docID string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT id FROM block_vectors 
		WHERE doc_id = ? AND block_type = 'bookmark'
	`, docID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue // 跳过扫描失败的行
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// DeleteOrphanBookmarks 删除不在 keepBlockIDs 列表中的 bookmark 块
// keepBlockIDs 是文档中当前存在的 bookmark 块的 BlockNote ID
func (s *VectorStore) DeleteOrphanBookmarks(docID string, keepBlockIDs []string) error {
	// 构建保留的 bookmark ID 前缀集合
	keepPrefixes := make(map[string]bool)
	for _, blockID := range keepBlockIDs {
		prefix := fmt.Sprintf("%s_%s_bookmark", docID, blockID)
		keepPrefixes[prefix] = true
	}

	// 获取所有 bookmark 块
	allBookmarks, err := s.GetBookmarkBlockIDs(docID)
	if err != nil {
		return err
	}

	// 找出需要删除的块（ID 不以任何保留前缀开头）
	var toDelete []string
	for _, bookmarkID := range allBookmarks {
		shouldKeep := false
		for prefix := range keepPrefixes {
			if strings.HasPrefix(bookmarkID, prefix) {
				shouldKeep = true
				break
			}
		}
		if !shouldKeep {
			toDelete = append(toDelete, bookmarkID)
		}
	}

	if len(toDelete) > 0 {
		return s.DeleteBlocks(toDelete)
	}
	return nil
}

// GetFileBlockIDs 获取文档的所有 file 块 ID
func (s *VectorStore) GetFileBlockIDs(docID string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT id FROM block_vectors
		WHERE doc_id = ? AND block_type = 'file'
	`, docID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue // 跳过扫描失败的行
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// DeleteOrphanFiles 删除不在 keepFileBlocks 列表中的 file 块
// keepFileBlocks 是文档中当前存在的 file 块信息
// 返回被删除的孤儿文件路径列表（用于删除物理文件）
func (s *VectorStore) DeleteOrphanFiles(docID string, keepFileBlocks []FileBlockInfo) ([]string, error) {
	// 构建保留的 file ID 前缀集合
	keepPrefixes := make(map[string]bool)
	for _, fb := range keepFileBlocks {
		prefix := fmt.Sprintf("%s_%s_file", docID, fb.BlockID)
		keepPrefixes[prefix] = true
	}

	// 获取所有 file 块（包含文件路径）
	rows, err := s.db.Query(`
		SELECT id, file_path FROM block_vectors
		WHERE doc_id = ? AND block_type = 'file'
	`, docID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var toDelete []string
	orphanFilePaths := make(map[string]bool) // 使用 map 去重

	for rows.Next() {
		var id string
		var filePath *string
		if err := rows.Scan(&id, &filePath); err != nil {
			continue
		}

		// 检查是否应该保留
		shouldKeep := false
		for prefix := range keepPrefixes {
			if strings.HasPrefix(id, prefix) {
				shouldKeep = true
				break
			}
		}

		if !shouldKeep {
			toDelete = append(toDelete, id)
			// 收集孤儿文件路径
			if filePath != nil && *filePath != "" {
				orphanFilePaths[*filePath] = true
			}
		}
	}

	// 删除 RAG 索引
	if len(toDelete) > 0 {
		if err := s.DeleteBlocks(toDelete); err != nil {
			return nil, err
		}
	}

	// 转换为切片返回
	var result []string
	for path := range orphanFilePaths {
		result = append(result, path)
	}

	return result, nil
}

// DeleteNonBookmarkByDocID 删除文档的所有非 bookmark/file 块（保留外部索引块）
func (s *VectorStore) DeleteNonBookmarkByDocID(docID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 获取要删除的非 bookmark/file block IDs
	rows, err := tx.Query(`
		SELECT id FROM block_vectors 
		WHERE doc_id = ? AND block_type NOT IN ('bookmark', 'file')
	`, docID)
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
