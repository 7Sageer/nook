package rag

import (
	"encoding/json"
	"strings"
)

// ExtractedBlock 提取的块信息
type ExtractedBlock struct {
	ID             string
	SourceBlockID  string // 原始块 ID（用于定位，对于合并/聚合块，保存第一个原始块 ID）
	Type           string
	Content        string
	HeadingContext string // 最近的 heading 文本
}

// 列表类型常量
var listTypes = map[string]bool{
	"bulletListItem":   true,
	"numberedListItem": true,
	"checkListItem":    true,
}

// ExternalBlockIDs 外部块（bookmark/file）的 ID 集合
type ExternalBlockIDs struct {
	BookmarkIDs []string
	FileIDs     []string
}

// ExtractExternalBlockIDs 一次解析提取所有外部块（bookmark/file）的 ID
// 用于清理孤儿索引，避免多次解析 JSON
func ExtractExternalBlockIDs(content []byte) ExternalBlockIDs {
	var blocks []interface{}
	if err := json.Unmarshal(content, &blocks); err != nil {
		return ExternalBlockIDs{}
	}

	result := ExternalBlockIDs{}
	extractExternalIDsRecursive(blocks, &result)
	return result
}

// extractExternalIDsRecursive 递归提取外部块 ID
func extractExternalIDsRecursive(blocks []interface{}, result *ExternalBlockIDs) {
	for _, block := range blocks {
		if blockMap, ok := block.(map[string]interface{}); ok {
			if blockType, ok := blockMap["type"].(string); ok {
				if id, ok := blockMap["id"].(string); ok {
					switch blockType {
					case "bookmark":
						result.BookmarkIDs = append(result.BookmarkIDs, id)
					case "file":
						result.FileIDs = append(result.FileIDs, id)
					}
				}
			}
			// 递归处理 children
			if children, ok := blockMap["children"].([]interface{}); ok {
				extractExternalIDsRecursive(children, result)
			}
		}
	}
}

// ExtractBookmarkBlockIDs 从文档 JSON 中提取所有 bookmark 块的 ID（兼容旧接口）
func ExtractBookmarkBlockIDs(content []byte) []string {
	return ExtractExternalBlockIDs(content).BookmarkIDs
}

// ExtractFileBlockIDs 从文档 JSON 中提取所有 file 块的 ID（兼容旧接口）
func ExtractFileBlockIDs(content []byte) []string {
	return ExtractExternalBlockIDs(content).FileIDs
}

// ExtractBlocks 从 BlockNote JSON 内容提取块（使用默认配置）
func ExtractBlocks(content []byte) []ExtractedBlock {
	return ExtractBlocksWithConfig(content, DefaultChunkConfig)
}

// ExtractBlocksWithConfig 从 BlockNote JSON 内容提取块（使用指定配置）
func ExtractBlocksWithConfig(content []byte, config ChunkConfig) []ExtractedBlock {
	var blocks []map[string]interface{}
	if err := json.Unmarshal(content, &blocks); err != nil {
		return nil
	}

	var result []ExtractedBlock
	var currentHeading string

	// 第一遍：提取所有原始块
	var rawBlocks []ExtractedBlock
	for _, block := range blocks {
		extracted := extractBlock(block)

		// 追踪 heading 上下文
		if strings.HasPrefix(extracted.Type, "heading") {
			currentHeading = extracted.Content
		}
		extracted.HeadingContext = currentHeading

		// 处理嵌套内容（children）
		if children, ok := block["children"].([]interface{}); ok && len(children) > 0 {
			childBlocks := extractNestedBlocks(children, currentHeading, 1)
			rawBlocks = append(rawBlocks, childBlocks...)
		}

		if extracted.Content != "" {
			rawBlocks = append(rawBlocks, extracted)
		}
	}

	// 第二遍：聚合列表块
	i := 0
	var afterListAggregation []ExtractedBlock
	for i < len(rawBlocks) {
		block := rawBlocks[i]

		if listTypes[block.Type] {
			// 开始聚合连续的同类型列表
			aggregated := aggregateListBlocks(rawBlocks, &i, block.Type, block.HeadingContext)
			afterListAggregation = append(afterListAggregation, aggregated)
		} else {
			// 非列表块：检查是否需要分割长块
			if config.MaxChunkSize > 0 && len(block.Content) > config.MaxChunkSize {
				splitBlocks := splitLongBlock(block, config)
				afterListAggregation = append(afterListAggregation, splitBlocks...)
			} else {
				afterListAggregation = append(afterListAggregation, block)
			}
			i++
		}
	}

	// 第三遍：合并 heading 到下一个内容块
	afterHeadingMerge := mergeHeadingsWithContent(afterListAggregation)

	// 第四遍：合并连续的短块
	result = mergeShortBlocks(afterHeadingMerge, config)

	return result
}

// extractNestedBlocks 递归提取嵌套块内容
func extractNestedBlocks(children []interface{}, heading string, depth int) []ExtractedBlock {
	var result []ExtractedBlock
	indent := strings.Repeat("  ", depth)

	for _, child := range children {
		if childBlock, ok := child.(map[string]interface{}); ok {
			extracted := extractBlock(childBlock)
			if extracted.Content != "" {
				// 添加缩进以表示层级
				extracted.Content = indent + extracted.Content
				extracted.HeadingContext = heading
				result = append(result, extracted)
			}

			// 递归处理更深层嵌套
			if grandChildren, ok := childBlock["children"].([]interface{}); ok && len(grandChildren) > 0 {
				nested := extractNestedBlocks(grandChildren, heading, depth+1)
				result = append(result, nested...)
			}
		}
	}
	return result
}

// aggregateListBlocks 聚合连续的同类型列表块
func aggregateListBlocks(blocks []ExtractedBlock, index *int, listType string, heading string) ExtractedBlock {
	var contents []string
	var ids []string
	var firstBlockID string

	for *index < len(blocks) && blocks[*index].Type == listType {
		block := blocks[*index]
		contents = append(contents, "• "+block.Content)
		ids = append(ids, block.ID)
		// 保存第一个原始块 ID 用于定位
		if firstBlockID == "" {
			firstBlockID = block.ID
		}
		*index++
	}

	// 生成聚合块的 ID（基于所有原始 ID 的哈希）
	aggregatedID := generateAggregatedID(ids)

	return ExtractedBlock{
		ID:             aggregatedID,
		SourceBlockID:  firstBlockID,
		Type:           "aggregated_" + listType,
		Content:        strings.Join(contents, "\n"),
		HeadingContext: heading,
	}
}

// mergeHeadingsWithContent 将 heading 块合并到下一个内容块
// 规则：
// 1. heading 不单独成为 chunk
// 2. 连续的 heading 全部合并到下一个非 heading 块
// 3. 如果文档以 heading 结尾（没有后续内容），保留该 heading
func mergeHeadingsWithContent(blocks []ExtractedBlock) []ExtractedBlock {
	if len(blocks) == 0 {
		return blocks
	}

	var result []ExtractedBlock
	var pendingHeadings []string

	for _, block := range blocks {
		if strings.HasPrefix(block.Type, "heading") {
			// 收集 heading，暂不输出
			pendingHeadings = append(pendingHeadings, block.Content)
		} else {
			// 非 heading 块：将之前的 heading 作为前缀
			if len(pendingHeadings) > 0 {
				prefix := strings.Join(pendingHeadings, "\n") + "\n\n"
				block.Content = prefix + block.Content
				pendingHeadings = nil
			}
			result = append(result, block)
		}
	}

	// 处理末尾的 heading（没有后续内容的情况）
	if len(pendingHeadings) > 0 {
		result = append(result, ExtractedBlock{
			ID:             generateAggregatedID(pendingHeadings),
			Type:           "trailing_headings",
			Content:        strings.Join(pendingHeadings, "\n"),
			HeadingContext: pendingHeadings[len(pendingHeadings)-1],
		})
	}

	return result
}

// extractBlock 从单个 block 提取信息
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
