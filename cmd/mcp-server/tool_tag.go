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
