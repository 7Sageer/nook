package main

import "encoding/json"

func (s *MCPServer) toolListFolders() ToolCallResult {
	folders, err := s.folderRepo.GetAll()
	if err != nil {
		return errorResult("Failed to list folders: " + err.Error())
	}
	data, _ := json.MarshalIndent(folders, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolMoveDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID    string `json:"doc_id"`
		FolderID string `json:"folder_id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if err := s.docRepo.MoveToFolder(params.DocID, params.FolderID); err != nil {
		return errorResult("Failed to move: " + err.Error())
	}
	return textResult("Document moved successfully")
}
