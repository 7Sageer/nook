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
				s.docRepo.RemoveTag(doc.ID, params.OldName)
				s.docRepo.AddTag(doc.ID, params.NewName)
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
				s.docRepo.RemoveTag(doc.ID, params.Name)
				break
			}
		}
	}
	if err := s.tagStore.DeleteGroup(params.Name); err != nil {
		return errorResult("Failed to delete tag group: " + err.Error())
	}
	return textResult("Tag group deleted successfully")
}

func (s *MCPServer) toolSetTagGroupCollapsed(args json.RawMessage) ToolCallResult {
	var params struct {
		Name      string `json:"name"`
		Collapsed bool   `json:"collapsed"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if params.Name == "" {
		return errorResult("name is required")
	}
	if err := s.tagStore.SetGroupCollapsed(params.Name, params.Collapsed); err != nil {
		return errorResult("Failed to set collapsed state: " + err.Error())
	}
	return textResult("Tag group collapsed state updated")
}
