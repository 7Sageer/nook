package main

import (
	"os"
	"path/filepath"
	"regexp"
	"time"
)

// ========== 清理功能 ==========

// Cleanup 执行所有清理任务
func (a *App) Cleanup() {
	a.cleanupUnusedImages()
	a.cleanupTempFiles()
}

// cleanupUnusedImages 清理未被任何文档引用的图像文件
func (a *App) cleanupUnusedImages() {
	imagesDir := filepath.Join(a.dataPath, "images")

	// 获取所有图像文件
	entries, err := os.ReadDir(imagesDir)
	if err != nil {
		return // 目录不存在或无法读取
	}

	if len(entries) == 0 {
		return
	}

	// 收集所有文档中引用的图像
	referencedImages := make(map[string]bool)
	imagePattern := regexp.MustCompile(`/images/([^"\s\]]+)`)

	index, err := a.documentHandler.GetDocumentList()
	if err != nil {
		return
	}

	for _, doc := range index.Documents {
		content, err := a.documentHandler.LoadDocumentContent(doc.ID)
		if err != nil {
			continue
		}
		// 查找所有 /images/xxx 引用
		matches := imagePattern.FindAllStringSubmatch(content, -1)
		for _, match := range matches {
			if len(match) > 1 {
				referencedImages[match[1]] = true
			}
		}
	}

	// 删除未引用的图像
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !referencedImages[entry.Name()] {
			filePath := filepath.Join(imagesDir, entry.Name())
			_ = os.Remove(filePath) // 忽略错误
		}
	}
}

// cleanupTempFiles 清理超过 24 小时的临时文件
func (a *App) cleanupTempFiles() {
	tempDir := filepath.Join(a.dataPath, "temp")

	entries, err := os.ReadDir(tempDir)
	if err != nil {
		return // 目录不存在或无法读取
	}

	cutoff := time.Now().Add(-24 * time.Hour)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			filePath := filepath.Join(tempDir, entry.Name())
			_ = os.Remove(filePath) // 忽略错误
		}
	}
}
