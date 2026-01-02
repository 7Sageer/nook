package fileextract

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ExtractText 根据文件类型提取文本内容
func ExtractText(filePath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))

	extractor, ok := GetExtractor(ext)
	if !ok {
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}

	return extractor.Extract(filePath)
}

// IsSupportedFileType 检查文件类型是否支持
func IsSupportedFileType(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	_, ok := GetExtractor(ext)
	return ok
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
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".xls":  "application/vnd.ms-excel",
		".epub": "application/epub+zip",
		".md":   "text/markdown",
		".txt":  "text/plain",
		".html": "text/html",
		".htm":  "text/html",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}
