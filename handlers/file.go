package handlers

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"notion-lite/internal/constant"
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
	os.MkdirAll(imagesDir, 0755)

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
	os.MkdirAll(tempDir, 0755)

	// 生成唯一文件名
	filename := fmt.Sprintf("print_%s_%d.html", sanitizeFilename(title), time.Now().UnixMilli())
	filePath := filepath.Join(tempDir, filename)

	// 写入 HTML 文件
	if err := os.WriteFile(filePath, []byte(htmlContent), 0644); err != nil {
		return err
	}

	// 使用系统命令打开文件（macOS 使用 open 命令）
	cmd := exec.Command("open", filePath)
	return cmd.Start()
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
