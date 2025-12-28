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
		// Tag Group tools
		{
			Name:        "list_tag_groups",
			Description: "List all tag groups. Tag groups are special tags used to organize documents hierarchically (like folders).",
			InputSchema: InputSchema{Type: "object"},
		},
		{
			Name:        "create_tag_group",
			Description: "Create a new tag group. Documents can be organized by adding the group name as a tag to them.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name": {Type: "string", Description: "Tag group name"},
				},
				Required: []string{"name"},
			},
		},
		{
			Name:        "rename_tag_group",
			Description: "Rename a tag group. This also updates the tag in all documents that have it.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"old_name": {Type: "string", Description: "Current tag group name"},
					"new_name": {Type: "string", Description: "New tag group name"},
				},
				Required: []string{"old_name", "new_name"},
			},
		},
		{
			Name:        "delete_tag_group",
			Description: "Delete a tag group. This also removes the tag from all documents that have it.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name": {Type: "string", Description: "Tag group name to delete"},
				},
				Required: []string{"name"},
			},
		},
		{
			Name:        "set_tag_group_collapsed",
			Description: "Set the collapsed state of a tag group in the sidebar",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"name":      {Type: "string", Description: "Tag group name"},
					"collapsed": {Type: "boolean", Description: "Whether the group should be collapsed"},
				},
				Required: []string{"name", "collapsed"},
			},
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  ToolsListResult{Tools: tools},
	}
}
