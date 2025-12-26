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
	case "list_folders":
		result = s.toolListFolders()
	case "move_document":
		result = s.toolMoveDocument(params.Arguments)
	case "get_blocknote_schema":
		result = s.toolGetBlockNoteSchema()
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
