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

// ========== Tag Group tools ==========

func (s *MCPServer) toolListTagGroups() ToolCallResult {
	groups := s.tagStore.GetAllGroups()
	data, _ := json.MarshalIndent(groups, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolCreateTagGroup(args json.RawMessage) ToolCallResult {
	var params struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Name == "" {
		return errorResult("name is required")
	}
	if err := s.tagStore.CreateGroup(params.Name); err != nil {
		return errorResult("Failed to create tag group: " + err.Error())
	}
	return textResult("Tag group created successfully")
}

func (s *MCPServer) toolRenameTagGroup(args json.RawMessage) ToolCallResult {
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
				_ = s.docRepo.RemoveTag(doc.ID, params.OldName) // 忽略错误
				_ = s.docRepo.AddTag(doc.ID, params.NewName)    // 忽略错误
				break
			}
		}
	}
	if err := s.tagStore.RenameGroup(params.OldName, params.NewName); err != nil {
		return errorResult("Failed to rename tag group: " + err.Error())
	}
	return textResult("Tag group renamed successfully")
}

func (s *MCPServer) toolDeleteTagGroup(args json.RawMessage) ToolCallResult {
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
				_ = s.docRepo.RemoveTag(doc.ID, params.Name) // 忽略错误
				break
			}
		}
	}
	if err := s.tagStore.DeleteGroup(params.Name); err != nil {
		return errorResult("Failed to delete tag group: " + err.Error())
	}
	return textResult("Tag group deleted successfully")
}

func (s *MCPServer) toolListDocumentsByTag(args json.RawMessage) ToolCallResult {
	var params struct {
		Tag string `json:"tag"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Tag == "" {
		return errorResult("tag is required")
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

	data, _ := json.MarshalIndent(docs, "", "  ")
	return textResult(string(data))
}
