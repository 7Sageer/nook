package main

import "encoding/json"

func (s *MCPServer) toolListDocuments() ToolCallResult {
	index, err := s.docRepo.GetAll()
	if err != nil {
		return errorResult(err.Error())
	}
	data, _ := json.MarshalIndent(index, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolGetDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	content, err := s.docStorage.Load(params.ID)
	if err != nil {
		return errorResult("Failed to load document: " + err.Error())
	}
	return textResult(content)
}

func (s *MCPServer) toolCreateDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	json.Unmarshal(args, &params)

	// Validate BlockNote format if content provided
	if err := validateBlockNoteContent(params.Content); err != nil {
		return errorResult("Invalid BlockNote content: " + err.Error())
	}

	doc, err := s.docRepo.Create(params.Title)
	if err != nil {
		return errorResult("Failed to create document: " + err.Error())
	}

	if params.Content != "" {
		if err := s.docStorage.Save(doc.ID, params.Content); err != nil {
			return errorResult("Created but failed to save content: " + err.Error())
		}
		// 触发 RAG 索引
		if s.ragService != nil {
			go s.ragService.IndexDocument(doc.ID)
		}
	}

	data, _ := json.MarshalIndent(doc, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolUpdateDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID      string `json:"id"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	// Check document exists
	if _, err := s.docStorage.Load(params.ID); err != nil {
		return errorResult("Document not found: " + params.ID)
	}
	// Validate BlockNote format (must be JSON array)
	if err := validateBlockNoteContent(params.Content); err != nil {
		return errorResult("Invalid BlockNote content: " + err.Error())
	}
	if err := s.docStorage.Save(params.ID, params.Content); err != nil {
		return errorResult("Failed to update: " + err.Error())
	}
	s.docRepo.UpdateTimestamp(params.ID)
	// 触发 RAG 索引
	if s.ragService != nil {
		go s.ragService.IndexDocument(params.ID)
	}
	return textResult("Document updated successfully")
}

func (s *MCPServer) toolDeleteDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if err := s.docRepo.Delete(params.ID); err != nil {
		return errorResult("Failed to delete: " + err.Error())
	}
	// 删除 RAG 向量索引
	if s.ragService != nil {
		go s.ragService.DeleteDocument(params.ID)
	}
	return textResult("Document deleted successfully")
}

func (s *MCPServer) toolRenameDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if err := s.docRepo.Rename(params.ID, params.Title); err != nil {
		return errorResult("Failed to rename: " + err.Error())
	}
	return textResult("Document renamed successfully")
}
