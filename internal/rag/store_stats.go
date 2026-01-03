package rag

import "strings"

// GetIndexedDocCount 获取已索引的文档数量
func (s *VectorStore) GetIndexedDocCount() (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(DISTINCT doc_id) FROM block_vectors WHERE block_type != 'bookmark'`).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// GetIndexedStats 获取索引统计信息 (文档数, 书签数, 嵌入文件数, 文件夹数)
func (s *VectorStore) GetIndexedStats() (int, int, int, int, error) {
	// Count unique docs that have non-bookmark, non-file, and non-folder blocks
	var docCount int
	err := s.db.QueryRow(`SELECT COUNT(DISTINCT doc_id) FROM block_vectors WHERE block_type NOT IN ('bookmark', 'file', 'folder')`).Scan(&docCount)
	if err != nil {
		return 0, 0, 0, 0, err
	}

	// For bookmarks, we need to count unique "base" bookmarks, not chunks.
	// Since we don't have a separate table or column for base ID, we infer it from the ID.
	// ID format: {docID}_{blockID}_bookmark_chunk_{N} or {docID}_{blockID}_bookmark
	rows, err := s.db.Query(`SELECT id FROM block_vectors WHERE block_type = 'bookmark'`)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer func() { _ = rows.Close() }()

	uniqueBookmarks := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return 0, 0, 0, 0, err
		}

		baseID := id
		// If it's a chunk, strip the suffix to get the base ID
		if idx := strings.LastIndex(id, "_chunk_"); idx != -1 {
			baseID = id[:idx]
		}
		uniqueBookmarks[baseID] = true
	}

	// For files, count unique base file blocks (similar logic to bookmarks)
	// ID format: {docID}_{blockID}_file_chunk_{N} or {docID}_{blockID}_file
	fileRows, err := s.db.Query(`SELECT id FROM block_vectors WHERE block_type = 'file'`)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer func() { _ = fileRows.Close() }()

	uniqueFiles := make(map[string]bool)
	for fileRows.Next() {
		var id string
		if err := fileRows.Scan(&id); err != nil {
			return 0, 0, 0, 0, err
		}

		baseID := id
		// If it's a chunk, strip the suffix to get the base ID
		if idx := strings.LastIndex(id, "_chunk_"); idx != -1 {
			baseID = id[:idx]
		}
		uniqueFiles[baseID] = true
	}

	// For folders, count unique base folder blocks
	// ID format: {docID}_{blockID}_folder_chunk_{N} or {docID}_{blockID}_folder_{fileIndex}_chunk_{N}
	// Note: We use the base ID format: {docID}_{blockID}_folder
	folderRows, err := s.db.Query(`SELECT id FROM block_vectors WHERE block_type = 'folder'`)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer func() { _ = folderRows.Close() }()

	uniqueFolders := make(map[string]bool)
	for folderRows.Next() {
		var id string
		if err := folderRows.Scan(&id); err != nil {
			return 0, 0, 0, 0, err
		}

		// Extract base ID: {docID}_{blockID}_folder
		parts := strings.Split(id, "_")
		if len(parts) >= 3 {
			// Find the index of "folder"
			folderIdx := -1
			for i, p := range parts {
				if p == "folder" {
					folderIdx = i
					break
				}
			}
			if folderIdx != -1 {
				baseID := strings.Join(parts[:folderIdx+1], "_")
				uniqueFolders[baseID] = true
			}
		}
	}

	return docCount, len(uniqueBookmarks), len(uniqueFiles), len(uniqueFolders), nil
}
