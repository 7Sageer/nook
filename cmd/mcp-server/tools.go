package main

func (s *MCPServer) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	tools := []Tool{
		{
			Name:        "list_documents",
			Description: "List all documents in Nook with their metadata (id, title, tags, timestamps)",
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
			Description: "Search documents by keyword in title, content, and tags",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"query": {Type: "string", Description: "Search query"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "get_blocknote_schema",
			Description: "Get the BlockNote JSON schema documentation. Call this before creating or updating document content to understand the correct format.",
			InputSchema: InputSchema{Type: "object"},
		},
		// Tag tools
		{
			Name:        "add_tag",
			Description: "Add a tag to a document. Tags help categorize and filter documents. Use tag groups to organize documents hierarchically.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id": {Type: "string", Description: "Document ID"},
					"tag":    {Type: "string", Description: "Tag name to add"},
				},
				Required: []string{"doc_id", "tag"},
			},
		},
		{
			Name:        "remove_tag",
			Description: "Remove a tag from a document",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id": {Type: "string", Description: "Document ID"},
					"tag":    {Type: "string", Description: "Tag name to remove"},
				},
				Required: []string{"doc_id", "tag"},
			},
		},
		// Pinned Tag tools
		{
			Name:        "list_pinned_tags",
			Description: "List all pinned tags. Pinned tags are shown in the sidebar for quick access.",
			InputSchema: InputSchema{Type: "object"},
		},
		{
			Name:        "pin_tag",
			Description: "Pin a tag to the sidebar. Pinned tags are always visible for quick document organization.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name": {Type: "string", Description: "Tag name to pin"},
				},
				Required: []string{"name"},
			},
		},
		{
			Name:        "unpin_tag",
			Description: "Unpin a tag from the sidebar.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name": {Type: "string", Description: "Tag name to unpin"},
				},
				Required: []string{"name"},
			},
		},
		{
			Name:        "rename_tag",
			Description: "Rename a tag. This also updates the tag in all documents that have it.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"old_name": {Type: "string", Description: "Current tag name"},
					"new_name": {Type: "string", Description: "New tag name"},
				},
				Required: []string{"old_name", "new_name"},
			},
		},
		{
			Name:        "delete_tag",
			Description: "Delete a tag. This removes the tag from all documents.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name": {Type: "string", Description: "Tag name to delete"},
				},
				Required: []string{"name"},
			},
		},
		{
			Name:        "list_documents_by_tag",
			Description: "List all documents that have a specific tag",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"tag": {Type: "string", Description: "Tag name to filter by"},
				},
				Required: []string{"tag"},
			},
		},
		// RAG tools
		{
			Name:        "semantic_search",
			Description: "Search by semantic similarity using natural language. Use granularity='documents' to find relevant documents, or 'chunks' to find specific text blocks within documents.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"query":       {Type: "string", Description: "Natural language search query"},
					"limit":       {Type: "number", Description: "Maximum results to return (default: 5)"},
					"granularity": {Type: "string", Description: "Result granularity: 'documents' for document-level results (default), 'chunks' for text blocks"},
				},
				Required: []string{"query"},
			},
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  ToolsListResult{Tools: tools},
	}
}
