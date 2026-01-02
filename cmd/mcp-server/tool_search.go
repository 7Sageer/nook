package main

import "encoding/json"

func (s *MCPServer) toolSearchDocuments(args json.RawMessage) ToolCallResult {
	var params struct {
		Query string `json:"query"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// 默认值和上限
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 50 {
		params.Limit = 50
	}

	results, err := s.searchService.Search(params.Query)
	if err != nil {
		return errorResult("Search failed: " + err.Error())
	}

	// 限制结果数量
	total := len(results)
	if len(results) > params.Limit {
		results = results[:params.Limit]
	}

	// 构建结果
	type searchResult struct {
		Results interface{} `json:"results"`
		Total   int         `json:"total"`
		Limit   int         `json:"limit"`
	}

	output := searchResult{
		Results: results,
		Total:   total,
		Limit:   params.Limit,
	}

	data, _ := json.MarshalIndent(output, "", "  ")
	return textResult(string(data))
}
