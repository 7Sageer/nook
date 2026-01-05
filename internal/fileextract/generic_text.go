package fileextract

import (
	"fmt"
	"os"
	"unicode/utf8"
)

// GenericTextExtractor 通用文本提取器
// 用于处理未被特定提取器覆盖的文本文件（如代码文件）
type GenericTextExtractor struct{}

// IsTextFile 检测文件是否为文本文件
// 通过检查文件前 8KB 内容来判断
func IsTextFile(filePath string) (bool, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return false, err
	}
	defer func() { _ = file.Close() }()

	// 读取前 8KB
	buf := make([]byte, 8*1024)
	n, err := file.Read(buf)
	if err != nil && n == 0 {
		return false, err
	}
	buf = buf[:n]

	// 空文件视为文本文件
	if n == 0 {
		return true, nil
	}

	// 检查是否为有效的 UTF-8
	if !utf8.Valid(buf) {
		// 不是有效的 UTF-8，可能是二进制
		return false, nil
	}

	// 统计不可打印字符的比例
	// 允许常见的控制字符：\t, \n, \r
	nonPrintable := 0
	for _, b := range buf {
		if b < 32 && b != '\t' && b != '\n' && b != '\r' {
			nonPrintable++
		}
	}

	// 如果不可打印字符超过 10%，认为是二进制文件
	ratio := float64(nonPrintable) / float64(n)
	return ratio < 0.1, nil
}

// ExtractGenericText 提取通用文本文件内容
func ExtractGenericText(filePath string) (string, error) {
	// 先检测是否为文本文件
	isText, err := IsTextFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to check file type: %w", err)
	}
	if !isText {
		return "", fmt.Errorf("file appears to be binary, not text")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}
	return string(data), nil
}
