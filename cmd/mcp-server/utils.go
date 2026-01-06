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
// 采用分层验证策略：
// 1. 验证 JSON 格式和必需字段（严格）
// 2. 对未知 block type 记录警告但不拒绝（宽松）
func validateBlockNoteContent(content string) error {
	if content == "" {
		return nil
	}

	// 解析为通用 map 以支持灵活的字段检查
	var blocks []map[string]interface{}
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return fmt.Errorf("invalid JSON format: %w", err)
	}

	// 验证每个 block 的基本结构
	for i, block := range blocks {
		// 检查 id 字段
		id, hasID := block["id"].(string)
		if !hasID || id == "" {
			return fmt.Errorf("block %d: missing or invalid 'id' field", i)
		}

		// 检查 type 字段
		blockType, hasType := block["type"].(string)
		if !hasType || blockType == "" {
			return fmt.Errorf("block %d (id: %s): missing or invalid 'type' field", i, id)
		}

		// 对未知 type 记录警告但不拒绝（向前兼容）
		if !isKnownBlockType(blockType) {
			fmt.Printf("Warning: block %d (id: %s) has unknown type '%s', but allowing it\n", i, id, blockType)
		}
	}

	return nil
}

// isKnownBlockType 检查 block type 是否在已知列表中
// 包括标准 BlockNote types 和自定义 types
func isKnownBlockType(blockType string) bool {
	knownTypes := map[string]bool{
		// 标准 BlockNote block types
		"paragraph":        true,
		"heading":          true,
		"bulletListItem":   true,
		"numberedListItem": true,
		"checkListItem":    true,
		"image":            true,
		"table":            true,
		"tableRow":         true,
		"tableCell":        true,
		"codeBlock":        true,
		// 自定义 block types
		"file":     true,
		"bookmark": true,
		"folder":   true,
	}
	return knownTypes[blockType]
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
