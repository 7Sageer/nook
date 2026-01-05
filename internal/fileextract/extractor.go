package fileextract

import (
	"path/filepath"
	"strings"
)

// ExtractText 根据文件类型提取文本内容
// 优先使用特定的提取器（PDF, DOCX 等），如果没有则尝试通用文本提取
func ExtractText(filePath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))

	// 优先使用特定的提取器
	extractor, ok := GetExtractor(ext)
	if ok {
		return extractor.Extract(filePath)
	}

	// 没有特定提取器，尝试作为通用文本文件处理
	return ExtractGenericText(filePath)
}

// IsSupportedFileType 检查文件类型是否支持
// 对于已注册的特定类型直接返回 true
// 注意：此函数只检查扩展名，不检测文件内容
// 如果需要完整检测，请使用 IsSupportedFile
func IsSupportedFileType(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	_, ok := GetExtractor(ext)
	return ok
}

// IsSupportedFile 检查文件是否支持（包括内容检测）
// 会实际读取文件来判断是否为文本文件
func IsSupportedFile(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	// 已注册的特定类型
	if _, ok := GetExtractor(ext); ok {
		return true
	}
	// 尝试检测是否为文本文件
	isText, err := IsTextFile(filePath)
	return err == nil && isText
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
