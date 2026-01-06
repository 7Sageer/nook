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
		result = s.toolListDocuments(params.Arguments)
	case "get_document":
		result = s.toolGetDocument(params.Arguments)
	case "update_document":
		result = s.toolUpdateDocument(params.Arguments)
	case "edit_document":
		result = s.toolEditDocument(params.Arguments)
	case "delete_document":
		result = s.toolDeleteDocument(params.Arguments)
	case "rename_document":
		result = s.toolRenameDocument(params.Arguments)
	case "search_documents":
		result = s.toolSearchDocuments(params.Arguments)
	case "get_content_guide":
		result = s.toolGetContentGuide()
	// Tag tools
	case "list_tags":
		result = s.toolListTags()
	case "add_tag":
		result = s.toolAddTag(params.Arguments)
	case "remove_tag":
		result = s.toolRemoveTag(params.Arguments)
	// Pinned Tag tools
	case "list_pinned_tags":
		result = s.toolListPinnedTags()
	case "pin_tag":
		result = s.toolPinTag(params.Arguments)
	case "unpin_tag":
		result = s.toolUnpinTag(params.Arguments)
	case "rename_tag":
		result = s.toolRenameTag(params.Arguments)
	case "delete_tag":
		result = s.toolDeleteTag(params.Arguments)
	// External Block tools
	case "add_bookmark":
		result = s.toolAddBookmark(params.Arguments)
	case "add_file_reference":
		result = s.toolAddFileReference(params.Arguments)
	case "add_folder_reference":
		result = s.toolAddFolderReference(params.Arguments)
	// RAG tools
	case "semantic_search":
		result = s.toolSemanticSearch(params.Arguments)
	case "get_block_content":
		result = s.toolGetBlockContent(params.Arguments)

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
