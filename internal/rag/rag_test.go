package rag

import (
	"fmt"
	"os"
	"testing"

	"notion-lite/internal/document"
	"notion-lite/internal/utils"
)

func TestIndexBookmarkContent(t *testing.T) {
	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "rag-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer func() {
		if err := os.RemoveAll(tmpDir); err != nil {
			t.Logf("Failed to remove temp dir: %v", err)
		}
	}()

	paths := utils.NewPathBuilder(tmpDir)

	// 创建必要的子目录
	if err := os.MkdirAll(paths.DocumentsDir(), 0755); err != nil {
		t.Fatalf("Failed to create documents dir: %v", err)
	}

	// 创建 document repo 和 storage
	docRepo := document.NewRepository(paths)
	docStorage := document.NewStorage(paths)

	// 创建 RAG 服务
	service := NewService(paths, docRepo, docStorage)

	// 测试 URL
	testURL := "https://baoyu.io/blog/luck-surface-area-formula-good-luck"
	testDocID := "test-doc-123"
	testBlockID := "test-block-456"

	fmt.Printf("=== Testing IndexBookmarkContent ===\n")
	fmt.Printf("URL: %s\n", testURL)
	fmt.Printf("DocID: %s\n", testDocID)
	fmt.Printf("BlockID: %s\n", testBlockID)

	// 执行索引
	err = service.IndexBookmarkContent(testURL, testDocID, testBlockID)
	if err != nil {
		t.Fatalf("IndexBookmarkContent failed: %v", err)
	}

	fmt.Printf("\n✅ IndexBookmarkContent succeeded!\n")

	// 验证索引结果 - 尝试搜索
	fmt.Printf("\n=== Testing Search ===\n")
	results, err := service.SearchChunks("运气表面积", 5)
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	fmt.Printf("Search results count: %d\n", len(results))
	for i, r := range results {
		fmt.Printf("\n[%d] BlockID: %s\n", i, r.BlockID)
		fmt.Printf("    DocID: %s\n", r.DocID)
		fmt.Printf("    BlockType: %s\n", r.BlockType)
		fmt.Printf("    Score: %.4f\n", r.Score)
		contentPreview := r.Content
		if len(contentPreview) > 200 {
			contentPreview = contentPreview[:200] + "..."
		}
		fmt.Printf("    Content: %s\n", contentPreview)
	}

	if len(results) == 0 {
		t.Error("No search results found - indexing may have failed")
	}
}
