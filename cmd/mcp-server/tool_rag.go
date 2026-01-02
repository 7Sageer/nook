package main

import (
	"database/sql"
	"encoding/json"
)

func (s *MCPServer) toolSemanticSearch(args json.RawMessage) ToolCallResult {
	var params struct {
		Query       string `json:"query"`
		Limit       int    `json:"limit"`
		Granularity string `json:"granularity"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	if params.Limit <= 0 {
		params.Limit = 5
	}
	if params.Limit > 20 {
		params.Limit = 20
	}

	// Default to document-level search
	if params.Granularity == "" {
		params.Granularity = "documents"
	}

	if params.Granularity == "chunks" {
		results, err := s.ragService.Search(params.Query, params.Limit)
		if err != nil {
			return errorResult("Semantic search failed: " + err.Error())
		}
		data, _ := json.MarshalIndent(results, "", "  ")
		return textResult(string(data))
	}

	// Default: document-level search
	results, err := s.ragService.SearchDocuments(params.Query, params.Limit)
	if err != nil {
		return errorResult("Semantic search failed: " + err.Error())
	}
	data, _ := json.MarshalIndent(results, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolGetBlockContent(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID   string `json:"doc_id"`
		BlockID string `json:"block_id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	if params.DocID == "" || params.BlockID == "" {
		return errorResult("doc_id and block_id are required")
	}

	content, err := s.ragService.GetExternalBlockContent(params.DocID, params.BlockID)
	if err != nil {
		if err == sql.ErrNoRows {
			return errorResult("Block content not found. The block may not be indexed yet.")
		}
		return errorResult("Failed to get block content: " + err.Error())
	}

	data, _ := json.MarshalIndent(content, "", "  ")
	return textResult(string(data))
}
