package markdown

import (
	"context"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
func (s *Service) Import() (string, error) {
	filePath, err := runtime.OpenFileDialog(s.ctx, runtime.OpenDialogOptions{
		Title: "导入 Markdown 文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown Files (*.md)", Pattern: "*.md"},
		},
	})
	if err != nil {
		return "", err
	}
	if filePath == "" {
		return "", nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// Export 导出为 Markdown 文件
func (s *Service) Export(content string, defaultName string) error {
	if defaultName == "" {
		defaultName = "document"
	}
	filePath, err := runtime.SaveFileDialog(s.ctx, runtime.SaveDialogOptions{
		Title:           "导出为 Markdown",
		DefaultFilename: defaultName + ".md",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown Files (*.md)", Pattern: "*.md"},
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
