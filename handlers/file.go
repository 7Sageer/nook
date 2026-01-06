package handlers

import (
	"encoding/base64"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"notion-lite/internal/constant"
	"notion-lite/internal/fileextract"
	"notion-lite/internal/markdown"
	"notion-lite/internal/opengraph"
	"notion-lite/internal/utils"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileHandler 文件与图片处理器
type FileHandler struct {
	*BaseHandler
	markdownService *markdown.Service
}

// NewFileHandler 创建文件处理器
func NewFileHandler(
	base *BaseHandler,
	markdownService *markdown.Service,
) *FileHandler {
	return &FileHandler{
		BaseHandler:     base,
		markdownService: markdownService,
	}
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
	filePath, err := runtime.OpenFileDialog(h.Context(), runtime.OpenDialogOptions{
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

// PrintHTML 保存 HTML 到临时文件并在浏览器中打开
func (h *FileHandler) PrintHTML(htmlContent string, title string) error {
	// 创建临时目录
	tempDir := h.Paths().TempDir()
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
	return utils.OpenWithSystemApp(filePath)
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
	// 引用信息
	OriginalPath string `json:"originalPath"` // 原始绝对路径
	FileName     string `json:"fileName"`
	FileSize     int64  `json:"fileSize"`
	FileType     string `json:"fileType"`
	MimeType     string `json:"mimeType"`
	// 归档信息
	Archived     bool   `json:"archived"`
	ArchivedPath string `json:"archivedPath"` // 归档后的本地路径 /files/xxx
	ArchivedAt   int64  `json:"archivedAt"`   // 归档时间戳
	// 兼容旧数据
	FilePath string `json:"filePath"` // deprecated
}

// SaveFile 保存文件到 ~/.Nook/files/ 并返回文件信息
func (h *FileHandler) SaveFile(base64Data string, originalName string) (*FileInfo, error) {
	filesDir := h.Paths().FilesDir()
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

// OpenFileDialog 打开文件选择对话框（返回引用，不复制文件）
func (h *FileHandler) OpenFileDialog() (*FileInfo, error) {
	filePath, err := runtime.OpenFileDialog(h.Context(), runtime.OpenDialogOptions{
		Title: constant.DialogTitleSelectFile,
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterAll, Pattern: "*.*"},
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

	// 获取文件信息（不复制）
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	fileName := filepath.Base(filePath)
	return &FileInfo{
		OriginalPath: filePath,
		FileName:     fileName,
		FileSize:     info.Size(),
		FileType:     fileextract.GetFileType(fileName),
		MimeType:     fileextract.GetMimeType(fileName),
		Archived:     false,
	}, nil
}

// CopyFileToStorage 获取文件信息（用于拖拽上传，返回引用不复制）
func (h *FileHandler) CopyFileToStorage(sourcePath string) (*FileInfo, error) {
	// 获取文件信息
	info, err := os.Stat(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	fileName := filepath.Base(sourcePath)
	return &FileInfo{
		OriginalPath: sourcePath,
		FileName:     fileName,
		FileSize:     info.Size(),
		FileType:     fileextract.GetFileType(fileName),
		MimeType:     fileextract.GetMimeType(fileName),
		Archived:     false,
	}, nil
}

// OpenFileWithSystem 使用系统默认应用打开文件
func (h *FileHandler) OpenFileWithSystem(pathOrRelative string) error {
	fmt.Println("[OpenFileWithSystem] called with:", pathOrRelative)
	var fullPath string

	// 检查是否是应用内相对路径（如 /files/xxx, /images/xxx）
	isAppRelativePath := strings.HasPrefix(pathOrRelative, "/files/") ||
		strings.HasPrefix(pathOrRelative, "/images/") ||
		strings.HasPrefix(pathOrRelative, "/temp/")

	if !isAppRelativePath && filepath.IsAbs(pathOrRelative) {
		// 真正的绝对路径（如 FolderBlock 的 /Users/xxx/folderPath）
		fullPath = pathOrRelative
	} else {
		// 应用内相对路径（如 /files/xxx.md）
		fullPath = filepath.Join(h.Paths().DataPath(), strings.TrimPrefix(pathOrRelative, "/"))
	}
	fmt.Println("[OpenFileWithSystem] resolved fullPath:", fullPath)

	err := utils.OpenWithSystemApp(fullPath)
	if err != nil {
		fmt.Println("[OpenFileWithSystem] error:", err)
	} else {
		fmt.Println("[OpenFileWithSystem] success")
	}
	return err
}

// RevealInFinder 在文件管理器中显示文件
func (h *FileHandler) RevealInFinder(pathOrRelative string) error {
	var fullPath string

	// 检查是否是应用内相对路径（如 /files/xxx, /images/xxx）
	isAppRelativePath := strings.HasPrefix(pathOrRelative, "/files/") ||
		strings.HasPrefix(pathOrRelative, "/images/") ||
		strings.HasPrefix(pathOrRelative, "/temp/")

	if !isAppRelativePath && filepath.IsAbs(pathOrRelative) {
		// 真正的绝对路径（如 FolderBlock 的 /Users/xxx/folderPath）
		fullPath = pathOrRelative
	} else {
		// 应用内相对路径（如 /files/xxx.md）
		fullPath = filepath.Join(h.Paths().DataPath(), strings.TrimPrefix(pathOrRelative, "/"))
	}

	return utils.RevealInFileManager(fullPath)
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
