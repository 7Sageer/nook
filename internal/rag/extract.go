package rag

import (
	"encoding/json"
	"strings"
)

// ExtractedBlock 提取的块信息
type ExtractedBlock struct {
	ID      string
	Type    string
	Content string
}

// ExtractBlocks 从 BlockNote JSON 内容提取块
func ExtractBlocks(content []byte) []ExtractedBlock {
	var blocks []map[string]interface{}
	if err := json.Unmarshal(content, &blocks); err != nil {
		return nil
	}

	var result []ExtractedBlock
	for _, block := range blocks {
		extracted := extractBlock(block)
		if extracted.Content != "" {
			result = append(result, extracted)
		}
	}
	return result
}

func extractBlock(block map[string]interface{}) ExtractedBlock {
	extracted := ExtractedBlock{}

	// 获取 ID
	if id, ok := block["id"].(string); ok {
		extracted.ID = id
	}

	// 获取类型
	if blockType, ok := block["type"].(string); ok {
		extracted.Type = blockType
	}

	// 提取文本内容
	if content, ok := block["content"].([]interface{}); ok {
		extracted.Content = extractTextFromContent(content)
	}

	return extracted
}

// extractTextFromContent 从 BlockNote content 数组提取纯文本
func extractTextFromContent(content []interface{}) string {
	var texts []string
	for _, item := range content {
		if textItem, ok := item.(map[string]interface{}); ok {
			// 处理 text 类型
			if textItem["type"] == "text" {
				if text, ok := textItem["text"].(string); ok {
					texts = append(texts, text)
				}
			}
			// 处理 link 类型
			if textItem["type"] == "link" {
				if linkContent, ok := textItem["content"].([]interface{}); ok {
					texts = append(texts, extractTextFromContent(linkContent))
				}
			}
		}
	}
	return strings.TrimSpace(strings.Join(texts, ""))
}
