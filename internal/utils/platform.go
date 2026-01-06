package utils

import (
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
)

// Platform-specific utility functions

// OpenWithSystemApp 使用系统默认应用打开文件（跨平台）
func OpenWithSystemApp(filePath string) error {
	var cmd *exec.Cmd

	switch goruntime.GOOS {
	case "darwin":
		cmd = exec.Command("open", filePath)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", filePath)
	default: // linux and others
		cmd = exec.Command("xdg-open", filePath)
	}

	return cmd.Start()
}

// RevealInFileManager 在系统文件管理器中显示文件（跨平台）
func RevealInFileManager(filePath string) error {
	var cmd *exec.Cmd

	switch goruntime.GOOS {
	case "darwin":
		// macOS: open -R 会在 Finder 中显示并选中文件
		cmd = exec.Command("open", "-R", filePath)
	case "windows":
		// Windows: explorer /select, 会在资源管理器中显示并选中文件
		cmd = exec.Command("explorer", "/select,", filePath)
	default: // linux and others
		// Linux: 打开文件所在目录
		cmd = exec.Command("xdg-open", filepath.Dir(filePath))
	}

	return cmd.Start()
}

// GetMimeTypeByExtension 根据文件扩展名获取 MIME 类型
func GetMimeTypeByExtension(path string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))
	mimeTypes := map[string]string{
		"jpg":  "image/jpeg",
		"jpeg": "image/jpeg",
		"png":  "image/png",
		"gif":  "image/gif",
		"webp": "image/webp",
		"svg":  "image/svg+xml",
		"pdf":  "application/pdf",
		"doc":  "application/msword",
		"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"xls":  "application/vnd.ms-excel",
		"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"ppt":  "application/vnd.ms-powerpoint",
		"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"zip":  "application/zip",
		"rar":  "application/x-rar-compressed",
		"7z":   "application/x-7z-compressed",
		"txt":  "text/plain",
		"md":   "text/markdown",
		"html": "text/html",
		"css":  "text/css",
		"js":   "text/javascript",
		"json": "application/json",
		"xml":  "application/xml",
		"mp3":  "audio/mpeg",
		"wav":  "audio/wav",
		"mp4":  "video/mp4",
		"mov":  "video/quicktime",
		"avi":  "video/x-msvideo",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}
