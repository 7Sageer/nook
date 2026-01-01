package fileextract

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
	"github.com/nguyenthenguyen/docx"
	"golang.org/x/net/html"
)

// ExtractText 根据文件类型提取文本内容
func ExtractText(filePath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".md", ".txt":
		return extractPlainText(filePath)
	case ".pdf":
		return extractPDF(filePath)
	case ".docx":
		return extractDOCX(filePath)
	case ".html", ".htm":
		return extractHTML(filePath)
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

// extractPDF 提取 PDF 文件中的文本
func extractPDF(filePath string) (string, error) {
	f, r, err := pdf.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer func() { _ = f.Close() }()

	var buf bytes.Buffer
	totalPages := r.NumPage()

	for pageNum := 1; pageNum <= totalPages; pageNum++ {
		page := r.Page(pageNum)
		if page.V.IsNull() {
			continue
		}

		text, err := page.GetPlainText(nil)
		if err != nil {
			continue // 跳过解析失败的页面
		}
		buf.WriteString(text)
		buf.WriteString("\n")
	}

	result := strings.TrimSpace(buf.String())
	if result == "" {
		return "", fmt.Errorf("no text content found in PDF")
	}
	return result, nil
}

// extractDOCX 提取 DOCX 文件中的文本
func extractDOCX(filePath string) (string, error) {
	r, err := docx.ReadDocxFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open DOCX: %w", err)
	}
	defer func() { _ = r.Close() }()

	doc := r.Editable()
	content := doc.GetContent()

	// 清理 XML 标签，提取纯文本
	result := strings.TrimSpace(content)
	if result == "" {
		return "", fmt.Errorf("no text content found in DOCX")
	}
	return result, nil
}

// extractHTML 提取 HTML 文件中的文本
func extractHTML(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read HTML file: %w", err)
	}

	doc, err := html.Parse(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML: %w", err)
	}

	var buf bytes.Buffer
	extractTextFromNode(doc, &buf)

	result := strings.TrimSpace(buf.String())
	if result == "" {
		return "", fmt.Errorf("no text content found in HTML")
	}
	return result, nil
}

// extractTextFromNode 递归提取 HTML 节点中的文本
func extractTextFromNode(n *html.Node, buf *bytes.Buffer) {
	// 跳过 script 和 style 标签
	if n.Type == html.ElementNode && (n.Data == "script" || n.Data == "style") {
		return
	}

	if n.Type == html.TextNode {
		text := strings.TrimSpace(n.Data)
		if text != "" {
			buf.WriteString(text)
			buf.WriteString(" ")
		}
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		extractTextFromNode(c, buf)
	}

	// 在块级元素后添加换行
	if n.Type == html.ElementNode {
		switch n.Data {
		case "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr":
			buf.WriteString("\n")
		}
	}
}

// IsSupportedFileType 检查文件类型是否支持
func IsSupportedFileType(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".md", ".txt", ".pdf", ".docx", ".html", ".htm":
		return true
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
		".html": "text/html",
		".htm":  "text/html",
	}
	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}
