package fileextract

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// EPUBExtractor handles EPUB text extraction
type EPUBExtractor struct{}

func init() {
	Register(&EPUBExtractor{})
}

func (e *EPUBExtractor) SupportedExtensions() []string {
	return []string{".epub"}
}

func (e *EPUBExtractor) Extract(filePath string) (string, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open EPUB: %w", err)
	}
	defer func() { _ = r.Close() }()

	var buf bytes.Buffer

	// 遍历 ZIP 中的文件，提取 HTML/XHTML 内容
	for _, f := range r.File {
		ext := strings.ToLower(filepath.Ext(f.Name))
		if ext != ".html" && ext != ".xhtml" && ext != ".htm" {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			continue
		}

		data, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			continue
		}

		// 复用 HTML 文本提取逻辑 (defined in html.go)
		text := extractTextFromHTMLBytes(data)
		if text != "" {
			buf.WriteString(text)
			buf.WriteString("\n\n")
		}
	}

	result := strings.TrimSpace(buf.String())
	if result == "" {
		return "", fmt.Errorf("no text content found in EPUB")
	}
	return result, nil
}
