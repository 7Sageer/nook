package rag

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strings"
)

// ChunkConfig 分块配置
type ChunkConfig struct {
	MaxChunkSize        int // 长块分割阈值，默认 800
	Overlap             int // 重叠字符数，默认 100
	ShortBlockThreshold int // 短块阈值，低于此长度的块可能被合并，默认 150
	MaxMergedLength     int // 合并后最大长度，默认 600
}

// DefaultChunkConfig 默认分块配置
var DefaultChunkConfig = ChunkConfig{
	MaxChunkSize:        800,
	Overlap:             100,
	ShortBlockThreshold: 150,
	MaxMergedLength:     600,
}

// ExtractedBlock 提取的块信息
type ExtractedBlock struct {
	ID             string
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

	for *index < len(blocks) && blocks[*index].Type == listType {
		block := blocks[*index]
		contents = append(contents, "• "+block.Content)
		ids = append(ids, block.ID)
		*index++
	}

	// 生成聚合块的 ID（基于所有原始 ID 的哈希）
	aggregatedID := generateAggregatedID(ids)

	return ExtractedBlock{
		ID:             aggregatedID,
		Type:           "aggregated_" + listType,
		Content:        strings.Join(contents, "\n"),
		HeadingContext: heading,
	}
}

// generateAggregatedID 为聚合块生成唯一 ID
func generateAggregatedID(ids []string) string {
	combined := strings.Join(ids, "|")
	hash := sha256.Sum256([]byte(combined))
	return "agg_" + hex.EncodeToString(hash[:8])
}

// mergeShortBlocks 合并连续的短块
// 规则：
// 1. 只合并长度低于 ShortBlockThreshold 的块
// 2. 不跨 heading 边界合并
// 3. 合并后总长度不超过 MaxMergedLength
// 4. 不合并已经聚合的列表块
func mergeShortBlocks(blocks []ExtractedBlock, config ChunkConfig) []ExtractedBlock {
	if config.ShortBlockThreshold <= 0 {
		return blocks
	}

	var result []ExtractedBlock
	i := 0

	for i < len(blocks) {
		block := blocks[i]

		// 检查是否可以开始合并
		if canMergeBlock(block, config.ShortBlockThreshold) {
			// 尝试合并连续的短块
			merged, nextIndex := tryMergeConsecutiveShortBlocks(blocks, i, config)
			result = append(result, merged)
			i = nextIndex
		} else {
			result = append(result, block)
			i++
		}
	}

	return result
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

// canMergeBlock 判断一个块是否可以被合并
func canMergeBlock(block ExtractedBlock, threshold int) bool {
	// 已聚合的列表块不参与合并
	if strings.HasPrefix(block.Type, "aggregated_") {
		return false
	}
	// heading 块不参与合并
	if strings.HasPrefix(block.Type, "heading") {
		return false
	}
	// 长块不参与合并
	if len(block.Content) >= threshold {
		return false
	}
	return true
}

// tryMergeConsecutiveShortBlocks 尝试合并连续的短块
func tryMergeConsecutiveShortBlocks(blocks []ExtractedBlock, startIndex int, config ChunkConfig) (ExtractedBlock, int) {
	startBlock := blocks[startIndex]
	currentHeading := startBlock.HeadingContext

	var contents []string
	var ids []string
	totalLength := 0
	endIndex := startIndex

	for j := startIndex; j < len(blocks); j++ {
		block := blocks[j]

		// 检查是否可以继续合并
		if !canMergeBlock(block, config.ShortBlockThreshold) {
			break
		}

		// 检查 heading 边界
		if block.HeadingContext != currentHeading {
			break
		}

		// 检查合并后长度
		newLength := totalLength + len(block.Content)
		if totalLength > 0 {
			newLength += 1 // 换行符
		}
		if newLength > config.MaxMergedLength && totalLength > 0 {
			break
		}

		contents = append(contents, block.Content)
		ids = append(ids, block.ID)
		totalLength = newLength
		endIndex = j + 1
	}

	// 如果只有一个块，直接返回
	if len(contents) == 1 {
		return startBlock, endIndex
	}

	// 创建合并后的块
	return ExtractedBlock{
		ID:             generateAggregatedID(ids),
		Type:           "merged_short_blocks",
		Content:        strings.Join(contents, "\n"),
		HeadingContext: currentHeading,
	}, endIndex
}

// splitLongBlock 分割长块
func splitLongBlock(block ExtractedBlock, config ChunkConfig) []ExtractedBlock {
	content := block.Content
	if len(content) <= config.MaxChunkSize {
		return []ExtractedBlock{block}
	}

	// 按句子分割
	sentences := splitIntoSentences(content)

	var result []ExtractedBlock
	var currentChunk strings.Builder
	chunkIndex := 0

	for _, sentence := range sentences {
		// 如果添加这个句子会超过阈值，保存当前块并开始新块
		if currentChunk.Len() > 0 && currentChunk.Len()+len(sentence) > config.MaxChunkSize {
			result = append(result, ExtractedBlock{
				ID:             block.ID + "_chunk_" + string(rune('0'+chunkIndex)),
				Type:           block.Type + "_chunk",
				Content:        strings.TrimSpace(currentChunk.String()),
				HeadingContext: block.HeadingContext,
			})
			chunkIndex++

			// 应用 overlap：保留最后一部分内容
			overlapContent := getOverlapContent(currentChunk.String(), config.Overlap)
			currentChunk.Reset()
			currentChunk.WriteString(overlapContent)
		}

		currentChunk.WriteString(sentence)
	}

	// 保存最后一个块
	if currentChunk.Len() > 0 {
		result = append(result, ExtractedBlock{
			ID:             block.ID + "_chunk_" + string(rune('0'+chunkIndex)),
			Type:           block.Type + "_chunk",
			Content:        strings.TrimSpace(currentChunk.String()),
			HeadingContext: block.HeadingContext,
		})
	}

	// 如果分割结果只有一个块，返回原块
	if len(result) == 1 {
		return []ExtractedBlock{block}
	}

	return result
}

// splitIntoSentences 按句子分割文本
func splitIntoSentences(text string) []string {
	// 使用中英文句号、问号、感叹号作为分隔符
	re := regexp.MustCompile(`([。？！.?!]+)`)
	parts := re.Split(text, -1)
	delimiters := re.FindAllString(text, -1)

	var sentences []string
	for i, part := range parts {
		if part == "" {
			continue
		}
		sentence := part
		if i < len(delimiters) {
			sentence += delimiters[i]
		}
		sentences = append(sentences, sentence)
	}

	return sentences
}

// getOverlapContent 获取用于重叠的内容
func getOverlapContent(content string, overlap int) string {
	if len(content) <= overlap {
		return content
	}
	return content[len(content)-overlap:]
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
