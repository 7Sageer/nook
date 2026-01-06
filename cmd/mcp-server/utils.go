package main

import (
	"encoding/json"
	"fmt"
	"strings"
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

// replaceTextInBlocks 在 blocks 中搜索并替换文本
// 返回修改后的 blocks 和匹配次数
func replaceTextInBlocks(blocks []map[string]interface{}, oldText, newText string, matchCount *int) []map[string]interface{} {
	for i, block := range blocks {
		// 处理 content 数组
		if content, ok := block["content"].([]interface{}); ok {
			blocks[i]["content"] = replaceTextInContent(content, oldText, newText, matchCount)
		}
		// 递归处理子 blocks
		if children, ok := block["children"].([]interface{}); ok {
			childBlocks := make([]map[string]interface{}, len(children))
			for j, child := range children {
				if childMap, ok := child.(map[string]interface{}); ok {
					childBlocks[j] = childMap
				}
			}
			childBlocks = replaceTextInBlocks(childBlocks, oldText, newText, matchCount)
			// 转换回 []interface{}
			newChildren := make([]interface{}, len(childBlocks))
			for j, cb := range childBlocks {
				newChildren[j] = cb
			}
			blocks[i]["children"] = newChildren
		}
	}
	return blocks
}

// replaceTextInContent 在 content 数组中搜索并替换文本
func replaceTextInContent(content []interface{}, oldText, newText string, matchCount *int) []interface{} {
	for i, item := range content {
		if itemMap, ok := item.(map[string]interface{}); ok {
			if text, ok := itemMap["text"].(string); ok {
				if strings.Contains(text, oldText) {
					*matchCount++
					itemMap["text"] = strings.Replace(text, oldText, newText, 1)
					content[i] = itemMap
				}
			}
		}
	}
	return content
}
