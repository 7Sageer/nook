package main

import "encoding/json"

func (s *MCPServer) toolAddTag(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID string `json:"doc_id"`
		Tag   string `json:"tag"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.DocID == "" || params.Tag == "" {
		return errorResult("doc_id and tag are required")
	}
	if err := s.docRepo.AddTag(params.DocID, params.Tag); err != nil {
		return errorResult("Failed to add tag: " + err.Error())
	}
	return textResult("Tag added successfully")
}

func (s *MCPServer) toolRemoveTag(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID string `json:"doc_id"`
		Tag   string `json:"tag"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.DocID == "" || params.Tag == "" {
		return errorResult("doc_id and tag are required")
	}
	if err := s.docRepo.RemoveTag(params.DocID, params.Tag); err != nil {
		return errorResult("Failed to remove tag: " + err.Error())
	}
	return textResult("Tag removed successfully")
}

func (s *MCPServer) toolListTags() ToolCallResult {
	index, err := s.docRepo.GetAll()
	if err != nil {
		return errorResult("Failed to get documents: " + err.Error())
	}

	// Count tag usage
	tagCounts := make(map[string]int)
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			tagCounts[t]++
		}
	}

	// Build result
	type tagInfo struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	tags := make([]tagInfo, 0, len(tagCounts))
	for name, count := range tagCounts {
		tags = append(tags, tagInfo{Name: name, Count: count})
	}

	data, _ := json.MarshalIndent(tags, "", "  ")
	return textResult(string(data))
}

// ========== Pinned Tag tools ==========

func (s *MCPServer) toolListPinnedTags() ToolCallResult {
	pinned := s.tagStore.GetAllPinnedTags()
	data, _ := json.MarshalIndent(pinned, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolPinTag(args json.RawMessage) ToolCallResult {
	var params struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Name == "" {
		return errorResult("name is required")
	}
	if err := s.tagStore.PinTag(params.Name); err != nil {
		return errorResult("Failed to pin tag: " + err.Error())
	}
	return textResult("Tag pinned successfully")
}

func (s *MCPServer) toolRenameTag(args json.RawMessage) ToolCallResult {
	var params struct {
		OldName string `json:"old_name"`
		NewName string `json:"new_name"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.OldName == "" || params.NewName == "" {
		return errorResult("old_name and new_name are required")
	}
	// Update tags in all documents
	index, _ := s.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == params.OldName {
				_ = s.docRepo.RemoveTag(doc.ID, params.OldName)
				_ = s.docRepo.AddTag(doc.ID, params.NewName)
				break
			}
		}
	}
	if err := s.tagStore.RenameTag(params.OldName, params.NewName); err != nil {
		return errorResult("Failed to rename tag: " + err.Error())
	}
	return textResult("Tag renamed successfully")
}

func (s *MCPServer) toolUnpinTag(args json.RawMessage) ToolCallResult {
	var params struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Name == "" {
		return errorResult("name is required")
	}
	if err := s.tagStore.UnpinTag(params.Name); err != nil {
		return errorResult("Failed to unpin tag: " + err.Error())
	}
	return textResult("Tag unpinned successfully")
}

func (s *MCPServer) toolDeleteTag(args json.RawMessage) ToolCallResult {
	var params struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Name == "" {
		return errorResult("name is required")
	}
	// Remove tag from all documents
	index, _ := s.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == params.Name {
				_ = s.docRepo.RemoveTag(doc.ID, params.Name)
				break
			}
		}
	}
	if err := s.tagStore.DeleteTag(params.Name); err != nil {
		return errorResult("Failed to delete tag: " + err.Error())
	}
	return textResult("Tag deleted successfully")
}

func (s *MCPServer) toolListDocumentsByTag(args json.RawMessage) ToolCallResult {
	var params struct {
		Tag   string `json:"tag"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Tag == "" {
		return errorResult("tag is required")
	}

	// 默认值和上限
	if params.Limit <= 0 {
		params.Limit = 50
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	index, err := s.docRepo.GetAll()
	if err != nil {
		return errorResult("Failed to get documents: " + err.Error())
	}

	type docInfo struct {
		ID    string   `json:"id"`
		Title string   `json:"title"`
		Tags  []string `json:"tags"`
	}
	var docs []docInfo
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == params.Tag {
				docs = append(docs, docInfo{
					ID:    doc.ID,
					Title: doc.Title,
					Tags:  doc.Tags,
				})
				break
			}
		}
	}

	// 限制结果数量
	total := len(docs)
	if len(docs) > params.Limit {
		docs = docs[:params.Limit]
	}

	// 构建结果
	type tagResult struct {
		Documents []docInfo `json:"documents"`
		Total     int       `json:"total"`
		Limit     int       `json:"limit"`
	}

	output := tagResult{
		Documents: docs,
		Total:     total,
		Limit:     params.Limit,
	}

	data, _ := json.MarshalIndent(output, "", "  ")
	return textResult(string(data))
}
