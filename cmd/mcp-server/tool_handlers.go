package main

import "encoding/json"

func (s *MCPServer) handleToolCall(req *JSONRPCRequest) *JSONRPCResponse {
	var params ToolCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &RPCError{Code: -32602, Message: "Invalid params"},
		}
	}

	var result ToolCallResult
	switch params.Name {
	case "list_documents":
		result = s.toolListDocuments()
	case "get_document":
		result = s.toolGetDocument(params.Arguments)
	case "create_document":
		result = s.toolCreateDocument(params.Arguments)
	case "update_document":
		result = s.toolUpdateDocument(params.Arguments)
	case "delete_document":
		result = s.toolDeleteDocument(params.Arguments)
	case "rename_document":
		result = s.toolRenameDocument(params.Arguments)
	case "search_documents":
		result = s.toolSearchDocuments(params.Arguments)
	case "get_blocknote_schema":
		result = s.toolGetBlockNoteSchema()
	// Tag tools
	case "add_tag":
		result = s.toolAddTag(params.Arguments)
	case "remove_tag":
		result = s.toolRemoveTag(params.Arguments)
	// Tag Group tools
	case "list_tag_groups":
		result = s.toolListTagGroups()
	case "create_tag_group":
		result = s.toolCreateTagGroup(params.Arguments)
	case "rename_tag_group":
		result = s.toolRenameTagGroup(params.Arguments)
	case "delete_tag_group":
		result = s.toolDeleteTagGroup(params.Arguments)
	case "set_tag_group_collapsed":
		result = s.toolSetTagGroupCollapsed(params.Arguments)
	default:
		result = ToolCallResult{
			Content: []ContentBlock{{Type: "text", Text: "Unknown tool: " + params.Name}},
			IsError: true,
		}
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}
