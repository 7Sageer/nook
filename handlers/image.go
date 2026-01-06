package handlers

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.design/x/clipboard"
)

// ImageHandler 图片处理器
type ImageHandler struct {
	*BaseHandler
}

// NewImageHandler 创建图片处理器
func NewImageHandler(base *BaseHandler) *ImageHandler {
	return &ImageHandler{BaseHandler: base}
}

// CopyImageToClipboard 将 base64 编码的 PNG 图片复制到剪贴板
func (h *ImageHandler) CopyImageToClipboard(base64Data string) error {
	// Initialize clipboard (required for golang.design/x/clipboard)
	err := clipboard.Init()
	if err != nil {
		return err
	}

	// Decode base64 data
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Write image to clipboard
	clipboard.Write(clipboard.FmtImage, imgData)
	return nil
}

// SaveImage 保存图片到本地并返回文件路径
func (h *ImageHandler) SaveImage(base64Data string, filename string) (string, error) {
	imagesDir := h.Paths().ImagesDir()
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create images directory: %w", err)
	}

	imgPath := filepath.Join(imagesDir, filename)

	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(imgPath, imgData, 0644); err != nil {
		return "", err
	}

	// Return /images/ URL for use in the editor (served by ImageHandler)
	return "/images/" + filename, nil
}

// SaveImageFile 保存图片到指定位置（通过文件对话框）
func (h *ImageHandler) SaveImageFile(base64Data string, defaultName string) error {
	// Decode base64 data first to validate
	imgData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Open save dialog
	filePath, err := runtime.SaveFileDialog(h.Context(), runtime.SaveDialogOptions{
		Title:           "Save as Image",
		DefaultFilename: defaultName + ".png",
		Filters: []runtime.FileFilter{
			{DisplayName: "PNG Image (*.png)", Pattern: "*.png"},
		},
	})
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil // User cancelled
	}

	// Ensure .png extension
	if !strings.HasSuffix(strings.ToLower(filePath), ".png") {
		filePath += ".png"
	}

	// Write image to file
	return os.WriteFile(filePath, imgData, 0644)
}
