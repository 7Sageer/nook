package main

func (s *MCPServer) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	tools := []Tool{
		{
			Name:        "list_documents",
			Description: "List all documents in Nook with their metadata (id, title, folder, timestamps)",
			InputSchema: InputSchema{Type: "object"},
		},
		{
			Name:        "get_document",
			Description: "Get the full content of a document by ID. Returns BlockNote JSON format.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id": {Type: "string", Description: "Document ID"},
				},
				Required: []string{"id"},
			},
		},
		{
			Name:        "create_document",
			Description: "Create a new document with optional title and content. Use get_blocknote_schema to get the correct JSON format.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"title":   {Type: "string", Description: "Document title (optional)"},
					"content": {Type: "string", Description: "Initial content as BlockNote JSON (optional)"},
				},
			},
		},
		{
			Name:        "update_document",
			Description: "Update a document's content. Use get_blocknote_schema to get the correct JSON format.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id":      {Type: "string", Description: "Document ID"},
					"content": {Type: "string", Description: "New content as BlockNote JSON"},
				},
				Required: []string{"id", "content"},
			},
		},
		{
			Name:        "delete_document",
			Description: "Delete a document by ID",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id": {Type: "string", Description: "Document ID"},
				},
				Required: []string{"id"},
			},
		},
		{
			Name:        "rename_document",
			Description: "Rename a document",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id":    {Type: "string", Description: "Document ID"},
					"title": {Type: "string", Description: "New title"},
				},
				Required: []string{"id", "title"},
			},
		},
		{
			Name:        "search_documents",
			Description: "Search documents by keyword in title and content",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"query": {Type: "string", Description: "Search query"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "list_folders",
			Description: "List all folders",
			InputSchema: InputSchema{Type: "object"},
		},
		{
			Name:        "move_document",
			Description: "Move a document to a folder",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id":    {Type: "string", Description: "Document ID"},
					"folder_id": {Type: "string", Description: "Target folder ID (empty for uncategorized)"},
				},
				Required: []string{"doc_id"},
			},
		},
		{
			Name:        "get_blocknote_schema",
			Description: "Get the BlockNote JSON schema documentation. Call this before creating or updating document content to understand the correct format.",
			InputSchema: InputSchema{Type: "object"},
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  ToolsListResult{Tools: tools},
	}
}
