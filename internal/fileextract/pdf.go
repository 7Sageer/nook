package fileextract

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"sync"

	"github.com/ledongthuc/pdf"
)

// PDFExtractor handles PDF text extraction
type PDFExtractor struct{}

var (
	pdftotextAvailable bool
	pdftotextMu        sync.Once
	pdftotextHintShown bool
)

func init() {
	Register(&PDFExtractor{})
}

func (e *PDFExtractor) SupportedExtensions() []string {
	return []string{".pdf"}
}

func (e *PDFExtractor) Extract(filePath string) (string, error) {
	// 优先尝试 pdftotext
	if e.checkPdftotextAvailable() {
		result, err := e.extractWithPdftotext(filePath)
		if err == nil && result != "" {
			return result, nil
		}
		// pdftotext 失败，回退到 Go 库
		fmt.Printf("⚠️ [PDF] pdftotext failed, falling back to Go library: %v\n", err)
	}

	// 回退：使用 Go 库
	return e.extractWithGoLib(filePath)
}

// checkPdftotextAvailable 检查系统是否安装了 pdftotext
func (e *PDFExtractor) checkPdftotextAvailable() bool {
	pdftotextMu.Do(func() {
		_, err := exec.LookPath("pdftotext")
		pdftotextAvailable = err == nil

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

// extractWithPdftotext 使用 pdftotext 命令提取 PDF 文本
// -layout 参数保留原始布局，对表格友好
func (e *PDFExtractor) extractWithPdftotext(filePath string) (string, error) {
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

// extractWithGoLib 使用 Go 库提取 PDF 文本（回退方案）
func (e *PDFExtractor) extractWithGoLib(filePath string) (string, error) {
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
