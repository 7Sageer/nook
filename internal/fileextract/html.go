package fileextract

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"golang.org/x/net/html"
)

// HTMLExtractor handles HTML text extraction
type HTMLExtractor struct{}

func init() {
	Register(&HTMLExtractor{})
}

func (e *HTMLExtractor) SupportedExtensions() []string {
	return []string{".html", ".htm"}
}

func (e *HTMLExtractor) Extract(filePath string) (string, error) {
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

// extractTextFromHTMLBytes 从 HTML 字节数据中提取文本
// Shared with EPUB extractor
func extractTextFromHTMLBytes(data []byte) string {
	doc, err := html.Parse(bytes.NewReader(data))
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	extractTextFromNode(doc, &buf)
	return strings.TrimSpace(buf.String())
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
