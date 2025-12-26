package main

import "encoding/json"

func (s *MCPServer) toolSearchDocuments(args json.RawMessage) ToolCallResult {
	var params struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	results, err := s.searchService.Search(params.Query)
	if err != nil {
		return errorResult("Search failed: " + err.Error())
	}
	data, _ := json.MarshalIndent(results, "", "  ")
	return textResult(string(data))
}
