package main

import (
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
