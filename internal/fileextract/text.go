package fileextract

import (
	"fmt"
	"os"
)

// TextExtractor handles plain text extraction
type TextExtractor struct{}

func init() {
	Register(&TextExtractor{})
}

func (e *TextExtractor) SupportedExtensions() []string {
	return []string{".txt", ".md"}
}

func (e *TextExtractor) Extract(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}
	return string(data), nil
}
