package main

func (s *MCPServer) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	tools := []Tool{
		{
			Name:        "list_documents",
			Description: "List all documents in Nook with their metadata (id, title, tags, timestamps). Optionally filter by tag.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"offset": {Type: "number", Description: "Skip first N documents (default: 0)"},
					"limit":  {Type: "number", Description: "Maximum documents to return (default: 50, max: 100)"},
					"tag":    {Type: "string", Description: "Optional: filter documents by tag name"},
				},
			},
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
			Name:        "update_document",
			Description: "Create or update a document. If the document ID exists, replaces its content; if not, creates a new document. Use get_content_guide to get the correct JSON format.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id":      {Type: "string", Description: "Document ID (use existing ID to update, or new UUID to create)"},
					"content": {Type: "string", Description: "Document content as BlockNote JSON"},
				},
				Required: []string{"id", "content"},
			},
		},
		{
			Name:        "edit_document",
			Description: "Edit a document using str_replace. Finds old_text in the document and replaces it with new_text. The old_text must be unique in the document.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"id":       {Type: "string", Description: "Document ID"},
					"old_text": {Type: "string", Description: "Text to find (must be unique in document)"},
					"new_text": {Type: "string", Description: "Text to replace with"},
				},
				Required: []string{"id", "old_text", "new_text"},
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
					"limit": {Type: "number", Description: "Maximum results to return (default: 20, max: 50)"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "get_content_guide",
			Description: "Get content creation guide including BlockNote JSON schema and writing style preferences. Call this before creating or updating document content.",
			InputSchema: InputSchema{Type: "object"},
		},
		// Tag tools
		{
			Name:        "list_tags",
			Description: "List all existing tags with usage counts. IMPORTANT: Call this BEFORE using add_tag to check for existing tags with similar meaning (e.g., '项目管理' vs 'Project Management'). Always prefer reusing existing tags over creating new ones to maintain consistency.",
			InputSchema: InputSchema{Type: "object"},
		},
		{
			Name:        "add_tag",
			Description: "Add a tag to a document. ⚠️ BEFORE adding a new tag, call list_tags first to check existing tags - avoid creating semantically similar tags (e.g., don't create 'Project Management' if '项目管理' exists). Reuse existing tags whenever possible.",
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
		// External Block tools
		{
			Name:        "add_bookmark",
			Description: "Add a bookmark block to a document. The bookmark will fetch webpage metadata (title, description, image) and can be indexed for RAG search. ⚠️ Note: Bookmarked content will be indexed, so only bookmark relevant resources to avoid cluttering the search index.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id":         {Type: "string", Description: "Document ID"},
					"url":            {Type: "string", Description: "URL to bookmark"},
					"after_block_id": {Type: "string", Description: "Optional: Insert after this block ID. If not provided, appends to end of document."},
				},
				Required: []string{"doc_id", "url"},
			},
		},
		{
			Name:        "add_file_reference",
			Description: "Add a file reference block to a document. The file content can be indexed for RAG search. ⚠️ Note: File content will be indexed, so only reference files that are relevant to avoid cluttering the search index. Supports PDF, DOCX, TXT, MD and other text-based formats.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id":         {Type: "string", Description: "Document ID"},
					"file_path":      {Type: "string", Description: "Absolute path to the file"},
					"after_block_id": {Type: "string", Description: "Optional: Insert after this block ID. If not provided, appends to end of document."},
				},
				Required: []string{"doc_id", "file_path"},
			},
		},
		{
			Name:        "add_folder_reference",
			Description: "Add a folder reference block to a document. All files in the folder can be indexed for RAG search. ⚠️ Note: All folder contents will be indexed, so only reference folders with relevant files to avoid cluttering the search index.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id":         {Type: "string", Description: "Document ID"},
					"folder_path":    {Type: "string", Description: "Absolute path to the folder"},
					"after_block_id": {Type: "string", Description: "Optional: Insert after this block ID. If not provided, appends to end of document."},
				},
				Required: []string{"doc_id", "folder_path"},
			},
		},
		// RAG tools
		{
			Name:        "semantic_search",
			Description: "Search by semantic similarity using natural language. Use granularity='documents' to find relevant documents, or 'chunks' to find specific text blocks within documents. Use doc_id to search within a specific document, or block_id to search within a specific bookmark/file/folder block (e.g., search within a specific PDF).",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"query":       {Type: "string", Description: "Natural language search query"},
					"limit":       {Type: "number", Description: "Maximum results to return (default: 5)"},
					"granularity": {Type: "string", Description: "Result granularity: 'documents' for document-level results (default), 'chunks' for text blocks"},
					"doc_id":      {Type: "string", Description: "Optional: limit search to a specific document"},
					"block_id":    {Type: "string", Description: "Optional: limit search to a specific block (e.g., a FileBlock containing a PDF, or a FolderBlock)"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "get_block_content",
			Description: "Get the extracted text content of a bookmark, file, or folder block. Returns the full readable content that was indexed for RAG search. Use this to read the actual content of bookmarked webpages, uploaded files, or get folder path information.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"doc_id":   {Type: "string", Description: "Document ID containing the block"},
					"block_id": {Type: "string", Description: "Block ID (the BlockNote block ID of the bookmark or file block)"},
				},
				Required: []string{"doc_id", "block_id"},
			},
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  ToolsListResult{Tools: tools},
	}
}
