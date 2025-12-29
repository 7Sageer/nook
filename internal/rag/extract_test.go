package rag

import (
	"testing"
)

func TestExtractBlocks_ListAggregation(t *testing.T) {
	// 测试连续列表块聚合
	jsonContent := `[
		{"id": "h1", "type": "heading", "content": [{"type": "text", "text": "购物清单"}]},
		{"id": "b1", "type": "bulletListItem", "content": [{"type": "text", "text": "苹果"}]},
		{"id": "b2", "type": "bulletListItem", "content": [{"type": "text", "text": "香蕉"}]},
		{"id": "b3", "type": "bulletListItem", "content": [{"type": "text", "text": "橙子"}]},
		{"id": "p1", "type": "paragraph", "content": [{"type": "text", "text": "这是一个段落"}]}
	]`

	blocks := ExtractBlocks([]byte(jsonContent))

	// 应该有 3 个块：heading, aggregated list, paragraph
	if len(blocks) != 3 {
		t.Errorf("Expected 3 blocks, got %d", len(blocks))
		for i, b := range blocks {
			t.Logf("Block %d: ID=%s, Type=%s, Content=%s", i, b.ID, b.Type, b.Content)
		}
	}

	// 检查列表是否被聚合
	foundAggregated := false
	for _, block := range blocks {
		if block.Type == "aggregated_bulletListItem" {
			foundAggregated = true
			// 应该包含所有列表项
			if !contains(block.Content, "苹果") || !contains(block.Content, "香蕉") || !contains(block.Content, "橙子") {
				t.Errorf("Aggregated block missing content: %s", block.Content)
			}
		}
	}
	if !foundAggregated {
		t.Error("Expected aggregated_bulletListItem block not found")
	}
}

func TestExtractBlocks_HeadingContext(t *testing.T) {
	// 测试 heading 上下文追踪
	jsonContent := `[
		{"id": "h1", "type": "heading", "content": [{"type": "text", "text": "第一章"}]},
		{"id": "p1", "type": "paragraph", "content": [{"type": "text", "text": "段落一"}]},
		{"id": "h2", "type": "heading", "content": [{"type": "text", "text": "第二章"}]},
		{"id": "p2", "type": "paragraph", "content": [{"type": "text", "text": "段落二"}]}
	]`

	blocks := ExtractBlocks([]byte(jsonContent))

	// 检查 heading 上下文
	for _, block := range blocks {
		if block.ID == "p1" && block.HeadingContext != "第一章" {
			t.Errorf("p1 should have heading context '第一章', got '%s'", block.HeadingContext)
		}
		if block.ID == "p2" && block.HeadingContext != "第二章" {
			t.Errorf("p2 should have heading context '第二章', got '%s'", block.HeadingContext)
		}
	}
}

func TestExtractBlocksWithConfig_LongBlockSplit(t *testing.T) {
	// 测试长块分割
	longText := "这是一个很长的段落。" +
		"它包含多个句子。" +
		"每个句子都应该被正确识别。" +
		"分割后应该保持语义完整性。" +
		"这是第五个句子。" +
		"第六个句子在这里。" +
		"第七个句子继续。" +
		"第八个句子出现。" +
		"第九个句子又来了。" +
		"最后一个句子结束。"

	jsonContent := `[
		{"id": "long1", "type": "paragraph", "content": [{"type": "text", "text": "` + longText + `"}]}
	]`

	config := ChunkConfig{
		MaxChunkSize: 50, // 设置较小的阈值以触发分割
		Overlap:      10,
	}

	blocks := ExtractBlocksWithConfig([]byte(jsonContent), config)

	// 应该被分割成多个块
	if len(blocks) < 2 {
		t.Errorf("Expected long block to be split into multiple chunks, got %d", len(blocks))
	}

	// 检查所有块都有正确的类型
	for _, block := range blocks {
		if block.Type != "paragraph_chunk" && block.Type != "paragraph" {
			t.Errorf("Unexpected block type: %s", block.Type)
		}
	}
}

func TestExtractBlocks_MixedListTypes(t *testing.T) {
	// 测试不同类型列表不被合并
	jsonContent := `[
		{"id": "b1", "type": "bulletListItem", "content": [{"type": "text", "text": "项目1"}]},
		{"id": "b2", "type": "bulletListItem", "content": [{"type": "text", "text": "项目2"}]},
		{"id": "n1", "type": "numberedListItem", "content": [{"type": "text", "text": "第一项"}]},
		{"id": "n2", "type": "numberedListItem", "content": [{"type": "text", "text": "第二项"}]}
	]`

	blocks := ExtractBlocks([]byte(jsonContent))

	// 应该有 2 个聚合块（bullet + numbered）
	if len(blocks) != 2 {
		t.Errorf("Expected 2 aggregated blocks, got %d", len(blocks))
		for i, b := range blocks {
			t.Logf("Block %d: ID=%s, Type=%s", i, b.ID, b.Type)
		}
	}

	bulletCount := 0
	numberedCount := 0
	for _, block := range blocks {
		if block.Type == "aggregated_bulletListItem" {
			bulletCount++
		}
		if block.Type == "aggregated_numberedListItem" {
			numberedCount++
		}
	}

	if bulletCount != 1 || numberedCount != 1 {
		t.Errorf("Expected 1 bullet and 1 numbered aggregated block, got bullet=%d, numbered=%d", bulletCount, numberedCount)
	}
}

func TestExtractBlocks_ShortBlockMerging(t *testing.T) {
	// 测试连续短块合并
	jsonContent := `[
		{"id": "h1", "type": "heading", "content": [{"type": "text", "text": "标题一"}]},
		{"id": "p1", "type": "paragraph", "content": [{"type": "text", "text": "短句1"}]},
		{"id": "p2", "type": "paragraph", "content": [{"type": "text", "text": "短句2"}]},
		{"id": "p3", "type": "paragraph", "content": [{"type": "text", "text": "短句3"}]},
		{"id": "h2", "type": "heading", "content": [{"type": "text", "text": "标题二"}]},
		{"id": "p4", "type": "paragraph", "content": [{"type": "text", "text": "短句4"}]},
		{"id": "p5", "type": "paragraph", "content": [{"type": "text", "text": "短句5"}]}
	]`

	config := ChunkConfig{
		MaxChunkSize:        800,
		Overlap:             100,
		ShortBlockThreshold: 150,
		MaxMergedLength:     600,
	}

	blocks := ExtractBlocksWithConfig([]byte(jsonContent), config)

	// 应该有 4 个块：heading1, merged(p1+p2+p3), heading2, merged(p4+p5)
	if len(blocks) != 4 {
		t.Errorf("Expected 4 blocks, got %d", len(blocks))
		for i, b := range blocks {
			t.Logf("Block %d: ID=%s, Type=%s, Content=%s, Heading=%s", i, b.ID, b.Type, b.Content, b.HeadingContext)
		}
		return
	}

	// 检查是否有合并块
	mergedCount := 0
	for _, block := range blocks {
		if block.Type == "merged_short_blocks" {
			mergedCount++
			// 第一个合并块应该在 heading 标题一下
			if block.HeadingContext == "标题一" {
				if !contains(block.Content, "短句1") || !contains(block.Content, "短句2") || !contains(block.Content, "短句3") {
					t.Errorf("First merged block missing content: %s", block.Content)
				}
			}
			// 第二个合并块应该在 heading 标题二下
			if block.HeadingContext == "标题二" {
				if !contains(block.Content, "短句4") || !contains(block.Content, "短句5") {
					t.Errorf("Second merged block missing content: %s", block.Content)
				}
			}
		}
	}

	if mergedCount != 2 {
		t.Errorf("Expected 2 merged blocks, got %d", mergedCount)
	}
}

func TestExtractBlocks_ShortBlockNotMergeAcrossHeading(t *testing.T) {
	// 测试短块不跨 heading 合并
	jsonContent := `[
		{"id": "p1", "type": "paragraph", "content": [{"type": "text", "text": "短句1"}]},
		{"id": "h1", "type": "heading", "content": [{"type": "text", "text": "中间标题"}]},
		{"id": "p2", "type": "paragraph", "content": [{"type": "text", "text": "短句2"}]}
	]`

	config := ChunkConfig{
		MaxChunkSize:        800,
		Overlap:             100,
		ShortBlockThreshold: 150,
		MaxMergedLength:     600,
	}

	blocks := ExtractBlocksWithConfig([]byte(jsonContent), config)

	// 应该有 3 个块：p1, heading, p2（因为 heading 边界阻止合并）
	if len(blocks) != 3 {
		t.Errorf("Expected 3 blocks (no merge across heading), got %d", len(blocks))
		for i, b := range blocks {
			t.Logf("Block %d: ID=%s, Type=%s, Content=%s", i, b.ID, b.Type, b.Content)
		}
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
