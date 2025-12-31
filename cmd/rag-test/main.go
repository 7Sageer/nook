package main

import (
	"fmt"
	"os"
	"path/filepath"

	"notion-lite/internal/document"
	"notion-lite/internal/rag"
)

func main() {
	// 获取数据目录
	homeDir, _ := os.UserHomeDir()
	dataPath := filepath.Join(homeDir, ".Nook")

	// 初始化依赖
	docRepo := document.NewRepository(dataPath)
	docStorage := document.NewStorage(dataPath)

	// 创建 RAG 服务
	ragService := rag.NewService(dataPath, docRepo, docStorage)

	// 检查是否需要重建索引
	count, _ := ragService.GetIndexedCount()
	if count == 0 {
		fmt.Println("📦 索引为空，开始重建...")
		indexed, err := ragService.ReindexAll()
		if err != nil {
			fmt.Printf("❌ 重建失败: %v\n", err)
			return
		}
		fmt.Printf("✅ 已索引 %d 个文档\n\n", indexed)
	}

	// 测试查询
	queries := []string{
		"文档",
		"bookmark",
		"test",
	}

	fmt.Println("=== RAG 语义搜索测试 ===")

	for _, query := range queries {
		fmt.Printf("🔍 查询: \"%s\"\n", query)
		fmt.Println("─────────────────────────────────────")

		results, err := ragService.SearchDocuments(query, 5)
		if err != nil {
			fmt.Printf("❌ 错误: %v\n\n", err)
			continue
		}

		if len(results) == 0 {
			fmt.Println("   (无结果)")
		} else {
			for i, r := range results {
				fmt.Printf("   [%d] 文档: %s (分数: %.4f)\n", i+1, r.DocTitle, r.MaxScore)
				if len(r.MatchedChunks) > 0 {
					chunk := r.MatchedChunks[0]
					content := chunk.Content
					if len(content) > 80 {
						content = content[:80] + "..."
					}
					fmt.Printf("       类型: %s, 内容: %s\n", chunk.BlockType, content)
				}
			}
		}
		fmt.Println()
	}
}
