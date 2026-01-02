package handlers

import (
	"context"
	"encoding/base64"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"time"

	"notion-lite/internal/constant"
	"notion-lite/internal/fileextract"
	"notion-lite/internal/markdown"
	"notion-lite/internal/opengraph"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/clipboard"
)

// FileHandler 文件与图片处理器
type FileHandler struct {
	ctx             context.Context
	dataPath        string
	markdownService *markdown.Service
}

// NewFileHandler 创建文件处理器
func NewFileHandler(
	ctx context.Context,
	dataPath string,
	markdownService *markdown.Service,
) *FileHandler {
	return &FileHandler{
		ctx:             ctx,
		dataPath:        dataPath,
		markdownService: markdownService,
	}
}

// SetContext 设置 context（用于启动后更新）
func (h *FileHandler) SetContext(ctx context.Context) {
	h.ctx = ctx
}

// ExternalFile 外部文件信息
type ExternalFile struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Content string `json:"content"`
}

// ImportMarkdownFile 导入 Markdown 文件
func (h *FileHandler) ImportMarkdownFile() (*markdown.ImportResult, error) {
	return h.markdownService.Import()
}

// ExportMarkdownFile 导出为 Markdown 文件
func (h *FileHandler) ExportMarkdownFile(content string, defaultName string) error {
	return h.markdownService.Export(content, defaultName)
}

// ExportHTMLFile 导出为 HTML 文件
func (h *FileHandler) ExportHTMLFile(content string, defaultName string) error {
	return h.markdownService.ExportHTML(content, defaultName)
}

// OpenExternalFile 打开外部文件对话框并读取内容
func (h *FileHandler) OpenExternalFile() (ExternalFile, error) {
	filePath, err := runtime.OpenFileDialog(h.ctx, runtime.OpenDialogOptions{
		Title: constant.DialogTitleOpenFile,
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterTextAndMarkdown, Pattern: "*.txt;*.md"},
			{DisplayName: constant.FilterMarkdown, Pattern: "*.md"},
			{DisplayName: constant.FilterText, Pattern: "*.txt"},
			{DisplayName: constant.FilterAll, Pattern: "*.*"},
		},
	})
	if err != nil {
		return ExternalFile{}, err
	}
	if filePath == "" {
		return ExternalFile{}, nil // 用户取消
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return ExternalFile{}, err
	}

	return ExternalFile{
		Path:    filePath,
		Name:    filepath.Base(filePath),
		Content: string(data),
	}, nil
}

// SaveExternalFile 保存内容到外部文件
func (h *FileHandler) SaveExternalFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

// LoadExternalFile 读取指定路径的文件内容
func (h *FileHandler) LoadExternalFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// CopyImageToClipboard 将 base64 编码的 PNG 图片复制到剪贴板
func (h *FileHandler) CopyImageToClipboard(base64Data string) error {
	// Initialize clipboard (required for golang.design/x/clipboard)
	err := clipboard.Init()
	if err != nil {
		return err
	}

	// Decode base64 data
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Write image to clipboard
	clipboard.Write(clipboard.FmtImage, imgData)
	return nil
}

// SaveImage 保存图片到本地并返回文件路径
func (h *FileHandler) SaveImage(base64Data string, filename string) (string, error) {
	imagesDir := filepath.Join(h.dataPath, "images")
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create images directory: %w", err)
	}

	imgPath := filepath.Join(imagesDir, filename)

	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(imgPath, imgData, 0644); err != nil {
		return "", err
	}

	// Return /images/ URL for use in the editor (served by ImageHandler)
	return "/images/" + filename, nil
}

// SaveImageFile 保存图片到指定位置（通过文件对话框）
func (h *FileHandler) SaveImageFile(base64Data string, defaultName string) error {
	// Decode base64 data first to validate
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Open save dialog
	filePath, err := runtime.SaveFileDialog(h.ctx, runtime.SaveDialogOptions{
		Title:           "Save as Image",
		DefaultFilename: defaultName + ".png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image (*.png)", Pattern: "*.png"},
		},
	})
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil // User cancelled
	}

	// Ensure .png extension
	if !strings.HasSuffix(strings.ToLower(filePath), ".png") {
		filePath += ".png"
	}

	// Write image to file
	return os.WriteFile(filePath, imgData, 0644)
}

// PrintHTML 保存 HTML 到临时文件并在浏览器中打开
func (h *FileHandler) PrintHTML(htmlContent string, title string) error {
	// 创建临时目录
	tempDir := filepath.Join(h.dataPath, "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("print_%s_%d.html", sanitizeFilename(title), time.Now().UnixMilli())
	filePath := filepath.Join(tempDir, filename)

	// 写入 HTML 文件
	if err := os.WriteFile(filePath, []byte(htmlContent), 0644); err != nil {
		return err
	}

	// 使用系统默认程序打开文件（跨平台）
	return openWithSystemApp(filePath)
}

// FetchLinkMetadata 获取链接的 Open Graph 元数据
func (h *FileHandler) FetchLinkMetadata(url string) (*opengraph.LinkMetadata, error) {
	return opengraph.Fetch(url)
}

// sanitizeFilename 清理文件名中的非法字符
func sanitizeFilename(name string) string {
	// 替换非法字符为下划线
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := name
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}
	// 限制长度
	if len(result) > 50 {
		result = result[:50]
	}
	return result
}

// ========== FileBlock 相关方法 ==========

// FileInfo 文件信息（返回给前端）
type FileInfo struct {
	FilePath string `json:"filePath"`
	FileName string `json:"fileName"`
	FileSize int64  `json:"fileSize"`
	FileType string `json:"fileType"`
	MimeType string `json:"mimeType"`
}

// SaveFile 保存文件到 ~/.Nook/files/ 并返回文件信息
func (h *FileHandler) SaveFile(base64Data string, originalName string) (*FileInfo, error) {
	filesDir := filepath.Join(h.dataPath, "files")
	if err := os.MkdirAll(filesDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create files directory: %w", err)
	}

	// 解码 base64
	fileData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode file: %w", err)
	}

	// 生成唯一文件名
	ext := filepath.Ext(originalName)
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), randomString(6), ext)
	filePath := filepath.Join(filesDir, filename)

	// 写入文件
	if err := os.WriteFile(filePath, fileData, 0644); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	return &FileInfo{
		FilePath: "/files/" + filename,
		FileName: originalName,
		FileSize: int64(len(fileData)),
		FileType: fileextract.GetFileType(originalName),
		MimeType: fileextract.GetMimeType(originalName),
	}, nil
}

// OpenFileDialog 打开文件选择对话框（支持 MD/TXT）
func (h *FileHandler) OpenFileDialog() (*FileInfo, error) {
	filePath, err := runtime.OpenFileDialog(h.ctx, runtime.OpenDialogOptions{
		Title: constant.DialogTitleSelectFile,
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterSupportedFiles, Pattern: "*.md;*.txt;*.pdf;*.docx;*.html;*.htm"},
			{DisplayName: constant.FilterMarkdown, Pattern: "*.md"},
			{DisplayName: constant.FilterText, Pattern: "*.txt"},
			{DisplayName: "PDF Files (*.pdf)", Pattern: "*.pdf"},
			{DisplayName: "Word Documents (*.docx)", Pattern: "*.docx"},
			{DisplayName: constant.FilterHTML, Pattern: "*.html;*.htm"},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil // 用户取消
	}

	// 读取文件并保存到 files 目录
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(data)
	return h.SaveFile(base64Data, filepath.Base(filePath))
}

// OpenFileWithSystem 使用系统默认应用打开文件
func (h *FileHandler) OpenFileWithSystem(relativePath string) error {
	// relativePath: /files/xxx.md
	fullPath := filepath.Join(h.dataPath, strings.TrimPrefix(relativePath, "/"))

	return openWithSystemApp(fullPath)
}

// randomString 生成随机字符串
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// openWithSystemApp 使用系统默认应用打开文件（跨平台）
func openWithSystemApp(filePath string) error {
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
