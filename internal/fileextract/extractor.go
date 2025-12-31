package fileextract

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ExtractText 根据文件类型提取文本内容
func ExtractText(filePath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".md", ".txt":
		return extractPlainText(filePath)
	case ".pdf":
		return "", fmt.Errorf("PDF extraction not yet implemented")
	case ".docx":
		return "", fmt.Errorf("DOCX extraction not yet implemented")
	default:
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}
}

// extractPlainText 读取纯文本文件
func extractPlainText(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}
	return string(data), nil
}

// IsSupportedFileType 检查文件类型是否支持
func IsSupportedFileType(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".md", ".txt":
		return true
	// 阶段二扩展
	// case ".pdf", ".docx":
	// 	return true
	default:
		return false
	}
}

// GetFileType 获取文件类型标识
func GetFileType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	return strings.TrimPrefix(ext, ".")
}

// GetMimeType 根据扩展名返回 MIME 类型
func GetMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	mimeTypes := map[string]string{
		".pdf":  "application/pdf",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".md":   "text/markdown",
		".txt":  "text/plain",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}
