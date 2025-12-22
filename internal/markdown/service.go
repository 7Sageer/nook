package markdown

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"notion-lite/internal/constant"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ImportResult 导入结果
type ImportResult struct {
	Content  string `json:"content"`
	FileName string `json:"fileName"`
}

// Service Markdown 导入导出服务
type Service struct {
	ctx context.Context
}

// NewService 创建 Markdown 服务
func NewService() *Service {
	return &Service{}
}

// SetContext 设置上下文（在 startup 时调用）
func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// Import 导入 Markdown 文件
func (s *Service) Import() (*ImportResult, error) {
	filePath, err := runtime.OpenFileDialog(s.ctx, runtime.OpenDialogOptions{
		Title: constant.DialogTitleImport,
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterMarkdown, Pattern: "*.md"},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return nil, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	fileName := filepath.Base(filePath)
	fileName = strings.TrimSuffix(fileName, filepath.Ext(fileName))

	return &ImportResult{
		Content:  string(data),
		FileName: fileName,
	}, nil
}

// Export 导出为 Markdown 文件
func (s *Service) Export(content string, defaultName string) error {
	if defaultName == "" {
		defaultName = constant.DefaultExportName
	}
	filePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           constant.DialogTitleExport,
		DefaultFilename: defaultName + ".md",
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterMarkdown, Pattern: "*.md"},
		},
	})
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil
	}

	return os.WriteFile(filePath, []byte(content), 0644)
}

// ExportHTML 导出为 HTML 文件
func (s *Service) ExportHTML(content string, defaultName string) error {
	if defaultName == "" {
		defaultName = constant.DefaultExportName
	}
	filePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           constant.DialogTitleExportHTML,
		DefaultFilename: defaultName + ".html",
		Filters: []runtime.FileFilter{
			{DisplayName: constant.FilterHTML, Pattern: "*.html"},
		},
	})
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil
	}

	return os.WriteFile(filePath, []byte(content), 0644)
}
