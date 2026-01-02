package fileextract

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/ledongthuc/pdf"
	"github.com/nguyenthenguyen/docx"
	"github.com/xuri/excelize/v2"
	"golang.org/x/net/html"
)

// 外部工具可用性缓存
var (
	pdftotextAvailable bool
	pdftotextChecked   bool
	pdftotextMu        sync.Once

	pandocAvailable bool
	pandocChecked   bool
	pandocMu        sync.Once

	// 是否已显示过安装提示
	pdftotextHintShown bool
	pandocHintShown    bool
)

// getInstallHint 根据操作系统返回安装命令提示
func getInstallHint(tool string) string {
	var macCmd, linuxCmd, winCmd string

	switch tool {
	case "pdftotext":
		macCmd = "brew install poppler"
		linuxCmd = "sudo apt install poppler-utils"
		winCmd = "choco install poppler"
	case "pandoc":
		macCmd = "brew install pandoc"
		linuxCmd = "sudo apt install pandoc"
		winCmd = "choco install pandoc"
	default:
		return ""
	}

	switch runtime.GOOS {
	case "darwin":
		return fmt.Sprintf("  安装命令: %s", macCmd)
	case "linux":
		return fmt.Sprintf("  安装命令: %s", linuxCmd)
	case "windows":
		return fmt.Sprintf("  安装命令: %s", winCmd)
	default:
		return fmt.Sprintf("  macOS: %s\n  Linux: %s\n  Windows: %s", macCmd, linuxCmd, winCmd)
	}
}

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
	case ".xlsx", ".xls":
		return extractXLSX(filePath)
	case ".epub":
		return extractEPUB(filePath)
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

// checkPdftotextAvailable 检查系统是否安装了 pdftotext
func checkPdftotextAvailable() bool {
	pdftotextMu.Do(func() {
		_, err := exec.LookPath("pdftotext")
		pdftotextAvailable = err == nil
		pdftotextChecked = true
		if pdftotextAvailable {
			fmt.Println("📄 [PDF] pdftotext detected, using enhanced extraction")
		} else if !pdftotextHintShown {
			pdftotextHintShown = true
			fmt.Println("💡 [PDF] 提示: 安装 poppler 可获得更好的 PDF 文本提取效果")
			fmt.Println(getInstallHint("pdftotext"))
			fmt.Println("  当前使用内置 Go 库作为回退方案")
		}
	})
	return pdftotextAvailable
}

// extractPDF 提取 PDF 文件中的文本
// 优先使用 pdftotext（如果可用），否则回退到 Go 库
func extractPDF(filePath string) (string, error) {
	// 优先尝试 pdftotext
	if checkPdftotextAvailable() {
		result, err := extractPDFWithPdftotext(filePath)
		if err == nil && result != "" {
			return result, nil
		}
		// pdftotext 失败，回退到 Go 库
		fmt.Printf("⚠️ [PDF] pdftotext failed, falling back to Go library: %v\n", err)
	}

	// 回退：使用 Go 库
	return extractPDFWithGoLib(filePath)
}

// extractPDFWithPdftotext 使用 pdftotext 命令提取 PDF 文本
// -layout 参数保留原始布局，对表格友好
func extractPDFWithPdftotext(filePath string) (string, error) {
	// pdftotext -layout file.pdf - (输出到 stdout)
	cmd := exec.Command("pdftotext", "-layout", "-enc", "UTF-8", filePath, "-")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("pdftotext failed: %w", err)
	}

	result := strings.TrimSpace(string(output))
	if result == "" {
		return "", fmt.Errorf("no text content found in PDF")
	}
	return result, nil
}

// extractPDFWithGoLib 使用 Go 库提取 PDF 文本（回退方案）
func extractPDFWithGoLib(filePath string) (string, error) {
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

// checkPandocAvailable 检查系统是否安装了 pandoc
func checkPandocAvailable() bool {
	pandocMu.Do(func() {
		_, err := exec.LookPath("pandoc")
		pandocAvailable = err == nil
		pandocChecked = true
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

// extractDOCX 提取 DOCX 文件中的文本
// 优先使用 pandoc（如果可用），否则回退到 XML 解析
func extractDOCX(filePath string) (string, error) {
	// 优先尝试 pandoc
	if checkPandocAvailable() {
		result, err := extractDOCXWithPandoc(filePath)
		if err == nil && result != "" {
			return result, nil
		}
		fmt.Printf("⚠️ [DOCX] pandoc failed, falling back to XML parsing: %v\n", err)
	}

	// 回退：解析 XML 提取文本
	return extractDOCXWithXML(filePath)
}

// extractDOCXWithPandoc 使用 pandoc 将 DOCX 转换为 Markdown
func extractDOCXWithPandoc(filePath string) (string, error) {
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

// extractDOCXWithXML 通过解析 XML 提取 DOCX 文本（回退方案）
func extractDOCXWithXML(filePath string) (string, error) {
	r, err := docx.ReadDocxFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open DOCX: %w", err)
	}
	defer func() { _ = r.Close() }()

	doc := r.Editable()
	content := doc.GetContent()

	// 解析 XML，提取 <w:t> 标签中的文本
	result := extractTextFromDOCXML(content)
	result = strings.TrimSpace(result)
	if result == "" {
		return "", fmt.Errorf("no text content found in DOCX")
	}
	return result, nil
}

// extractXLSX 提取 Excel 文件中的文本
func extractXLSX(filePath string) (string, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open XLSX: %w", err)
	}
	defer func() { _ = f.Close() }()

	var buf bytes.Buffer
	sheets := f.GetSheetList()

	for _, sheet := range sheets {
		rows, err := f.GetRows(sheet)
		if err != nil {
			continue
		}

		// 写入工作表名称
		if len(sheets) > 1 {
			buf.WriteString(fmt.Sprintf("=== %s ===\n", sheet))
		}

		for _, row := range rows {
			// 用制表符分隔单元格，保持表格结构
			buf.WriteString(strings.Join(row, "\t"))
			buf.WriteString("\n")
		}
		buf.WriteString("\n")
	}

	result := strings.TrimSpace(buf.String())
	if result == "" {
		return "", fmt.Errorf("no text content found in XLSX")
	}
	return result, nil
}

// extractEPUB 提取 EPUB 文件中的文本
// EPUB 本质是 ZIP 文件，包含 HTML/XHTML 内容
func extractEPUB(filePath string) (string, error) {
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

		// 复用 HTML 文本提取逻辑
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

// extractTextFromHTMLBytes 从 HTML 字节数据中提取文本
func extractTextFromHTMLBytes(data []byte) string {
	doc, err := html.Parse(bytes.NewReader(data))
	if err != nil {
		return ""
	}

	var buf bytes.Buffer
	extractTextFromNode(doc, &buf)
	return strings.TrimSpace(buf.String())
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

// extractTextFromDOCXML 从 DOCX XML 内容中提取纯文本
// DOCX 的文本内容存储在 <w:t> 标签中，段落由 <w:p> 分隔
func extractTextFromDOCXML(xmlContent string) string {
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

// IsSupportedFileType 检查文件类型是否支持
func IsSupportedFileType(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".md", ".txt", ".pdf", ".docx", ".xlsx", ".xls", ".epub", ".html", ".htm":
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
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".xls":  "application/vnd.ms-excel",
		".epub": "application/epub+zip",
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
