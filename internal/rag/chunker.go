package rag

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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

// ChunkTextContent 对纯文本进行分块（用于书签等外部内容）
// 按段落分割，合并短段落，分割长段落
func ChunkTextContent(text, headingContext, baseID string, config ChunkConfig) []ExtractedBlock {
	if strings.TrimSpace(text) == "" {
		return nil
	}

	// 1. 按双换行分割为段落
	paragraphs := strings.Split(text, "\n\n")
	var cleanParagraphs []string
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p != "" {
			cleanParagraphs = append(cleanParagraphs, p)
		}
	}

	if len(cleanParagraphs) == 0 {
		return nil
	}

	// 2. 合并短段落 + 分割长段落
	var chunks []string
	var currentChunk strings.Builder

	for _, para := range cleanParagraphs {
		// 如果段落本身就超长，先分割它
		if len(para) > config.MaxChunkSize {
			// 先保存当前累积的内容
			if currentChunk.Len() > 0 {
				chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
				currentChunk.Reset()
			}
			// 按句子分割长段落
			splitChunks := splitLongText(para, config)
			chunks = append(chunks, splitChunks...)
			continue
		}

		// 检查是否可以合并到当前 chunk
		newLen := currentChunk.Len() + len(para)
		if currentChunk.Len() > 0 {
			newLen += 2 // 换行符
		}

		if newLen <= config.MaxMergedLength || currentChunk.Len() == 0 {
			// 可以合并
			if currentChunk.Len() > 0 {
				currentChunk.WriteString("\n\n")
			}
			currentChunk.WriteString(para)
		} else {
			// 保存当前块，开始新块
			chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
			currentChunk.Reset()
			currentChunk.WriteString(para)
		}
	}

	// 保存最后一个块
	if currentChunk.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
	}

	// 3. 转换为 ExtractedBlock
	var result []ExtractedBlock
	for i, chunk := range chunks {
		if chunk == "" {
			continue
		}
		result = append(result, ExtractedBlock{
			ID:             fmt.Sprintf("%s_chunk_%d", baseID, i),
			Type:           "bookmark_chunk",
			Content:        chunk,
			HeadingContext: headingContext,
		})
	}

	return result
}

// splitLongText 分割超长文本
func splitLongText(text string, config ChunkConfig) []string {
	sentences := splitIntoSentences(text)
	var result []string
	var currentChunk strings.Builder

	for _, sentence := range sentences {
		if currentChunk.Len() > 0 && currentChunk.Len()+len(sentence) > config.MaxChunkSize {
			result = append(result, strings.TrimSpace(currentChunk.String()))
			// 应用 overlap
			overlapContent := getOverlapContent(currentChunk.String(), config.Overlap)
			currentChunk.Reset()
			currentChunk.WriteString(overlapContent)
		}
		currentChunk.WriteString(sentence)
	}

	if currentChunk.Len() > 0 {
		result = append(result, strings.TrimSpace(currentChunk.String()))
	}

	return result
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
	var firstBlockID string
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
		// 保存第一个原始块 ID 用于定位
		if firstBlockID == "" {
			// 优先使用原始块自身保存的 SourceBlockID（如果已经是合并块）
			if block.SourceBlockID != "" {
				firstBlockID = block.SourceBlockID
			} else {
				firstBlockID = block.ID
			}
		}
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
		SourceBlockID:  firstBlockID,
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

// generateAggregatedID 为聚合块生成唯一 ID
func generateAggregatedID(ids []string) string {
	combined := strings.Join(ids, "|")
	hash := sha256.Sum256([]byte(combined))
	return "agg_" + hex.EncodeToString(hash[:8])
}
