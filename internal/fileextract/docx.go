package fileextract

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"github.com/nguyenthenguyen/docx"
)

// DOCXExtractor handles DOCX text extraction
type DOCXExtractor struct{}

var (
	pandocAvailable bool
	pandocMu        sync.Once
	pandocHintShown bool
)

func init() {
	Register(&DOCXExtractor{})
}

func (e *DOCXExtractor) SupportedExtensions() []string {
	return []string{".docx"}
}

func (e *DOCXExtractor) Extract(filePath string) (string, error) {
	// 优先尝试 pandoc
	if e.checkPandocAvailable() {
		result, err := e.extractWithPandoc(filePath)
		if err == nil && result != "" {
			return result, nil
		}
		fmt.Printf("⚠️ [DOCX] pandoc failed, falling back to XML parsing: %v\n", err)
	}

	// 回退：解析 XML 提取文本
	return e.extractWithXML(filePath)
}

// checkPandocAvailable 检查系统是否安装了 pandoc
func (e *DOCXExtractor) checkPandocAvailable() bool {
	pandocMu.Do(func() {
		_, err := exec.LookPath("pandoc")
		pandocAvailable = err == nil

		if pandocAvailable {
			fmt.Println("📝 [DOCX] pandoc detected, using enhanced extraction")
		} else if !pandocHintShown {
			pandocHintShown = true
			fmt.Println("💡 [DOCX] 提示: 安装 pandoc 可获得更好的 DOCX 文本提取效果（保留格式）")
			fmt.Println(getInstallHint("pandoc"))
			fmt.Println("  当前使用内置 XML 解析作为回退方案")
		}
	})
	return pandocAvailable
}

// extractWithPandoc 使用 pandoc 将 DOCX 转换为 Markdown
func (e *DOCXExtractor) extractWithPandoc(filePath string) (string, error) {
	cmd := exec.Command("pandoc", "-f", "docx", "-t", "markdown", "--wrap=none", filePath)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("pandoc failed: %w", err)
	}

	result := strings.TrimSpace(string(output))
	if result == "" {
		return "", fmt.Errorf("no text content found in DOCX")
	}
	return result, nil
}

// extractWithXML 通过解析 XML 提取 DOCX 文本（回退方案）
func (e *DOCXExtractor) extractWithXML(filePath string) (string, error) {
	r, err := docx.ReadDocxFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open DOCX: %w", err)
	}
	defer func() { _ = r.Close() }()

	doc := r.Editable()
	content := doc.GetContent()

	// 解析 XML，提取 <w:t> 标签中的文本
	result := e.extractTextFromDOCXML(content)
	result = strings.TrimSpace(result)
	if result == "" {
		return "", fmt.Errorf("no text content found in DOCX")
	}
	return result, nil
}

// extractTextFromDOCXML 从 DOCX XML 内容中提取纯文本
// DOCX 的文本内容存储在 <w:t> 标签中，段落由 <w:p> 分隔
func (e *DOCXExtractor) extractTextFromDOCXML(xmlContent string) string {
	var buf bytes.Buffer
	decoder := xml.NewDecoder(strings.NewReader(xmlContent))

	var inParagraph bool
	var paragraphHasText bool

	for {
		token, err := decoder.Token()
		if err != nil {
			break
		}

		switch t := token.(type) {
		case xml.StartElement:
			// <w:p> 表示段落开始
			if t.Name.Local == "p" && t.Name.Space == "http://schemas.openxmlformats.org/wordprocessingml/2006/main" {
				inParagraph = true
				paragraphHasText = false
			}
		case xml.EndElement:
			// </w:p> 表示段落结束，添加换行
			if t.Name.Local == "p" && t.Name.Space == "http://schemas.openxmlformats.org/wordprocessingml/2006/main" {
				if inParagraph && paragraphHasText {
					buf.WriteString("\n")
				}
				inParagraph = false
			}
		case xml.CharData:
			// 文本内容（在 <w:t> 内部）
			text := strings.TrimSpace(string(t))
			if text != "" {
				buf.WriteString(text)
				paragraphHasText = true
			}
		}
	}

	return buf.String()
}
