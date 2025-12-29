package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"notion-lite/internal/document"
	"notion-lite/internal/rag"
	"notion-lite/internal/search"
	"notion-lite/internal/tag"
)

// JSON-RPC 2.0 structures
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// MCP Server
type MCPServer struct {
	docRepo       *document.Repository
	docStorage    *document.Storage
	tagStore      *tag.Store
	searchService *search.Service
	ragService    *rag.Service
	dataPath      string
}

func NewMCPServer() *MCPServer {
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".Nook")
	os.MkdirAll(dataPath, 0755)
	os.MkdirAll(filepath.Join(dataPath, "documents"), 0755)

	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)
	tagStore := tag.NewStore(dataPath)

	return &MCPServer{
		docRepo:       docRepo,
		docStorage:    docStorage,
		tagStore:      tagStore,
		searchService: search.NewService(docRepo, docStorage),
		ragService:    rag.NewService(dataPath, docRepo, docStorage),
		dataPath:      dataPath,
	}
}

func main() {
	server := NewMCPServer()
	scanner := bufio.NewScanner(os.Stdin)
	// Increase buffer size for large messages
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var req JSONRPCRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			sendError(nil, -32700, "Parse error", err.Error())
			continue
		}

		response := server.handleRequest(&req)
		if response != nil {
			sendResponse(response)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
		os.Exit(1)
	}
}

func sendResponse(resp *JSONRPCResponse) {
	data, _ := json.Marshal(resp)
	fmt.Println(string(data))
}

func sendError(id interface{}, code int, message string, data interface{}) {
	resp := &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &RPCError{
			Code:    code,
			Message: message,
			Data:    data,
		},
	}
	sendResponse(resp)
}
