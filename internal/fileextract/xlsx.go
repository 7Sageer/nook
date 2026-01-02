package fileextract

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

// XLSXExtractor handles Excel text extraction
type XLSXExtractor struct{}

func init() {
	Register(&XLSXExtractor{})
}

func (e *XLSXExtractor) SupportedExtensions() []string {
	return []string{".xlsx", ".xls"}
}

func (e *XLSXExtractor) Extract(filePath string) (string, error) {
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
