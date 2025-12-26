package main

import (
	"encoding/json"
	"fmt"
)

func textResult(text string) ToolCallResult {
	return ToolCallResult{
		Content: []ContentBlock{{Type: "text", Text: text}},
	}
}

func errorResult(msg string) ToolCallResult {
	return ToolCallResult{
		Content: []ContentBlock{{Type: "text", Text: msg}},
		IsError: true,
	}
}

// validateBlockNoteContent validates that content is a valid BlockNote JSON array
func validateBlockNoteContent(content string) error {
	if content == "" {
		return nil
	}
	var blocks []BlockNoteBlock
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return err
	}
	// Validate each block has required fields
	for i, block := range blocks {
		if block.ID == "" {
			return fmt.Errorf("block %d missing 'id' field", i)
		}
		if block.Type == "" {
			return fmt.Errorf("block %d missing 'type' field", i)
		}
	}
	return nil
}

// BlockNoteBlock represents a minimal BlockNote block structure
type BlockNoteBlock struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}
