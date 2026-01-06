package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ArchiveHandler 文件归档处理器
type ArchiveHandler struct {
	*BaseHandler
}

// NewArchiveHandler 创建归档处理器
func NewArchiveHandler(base *BaseHandler) *ArchiveHandler {
	return &ArchiveHandler{BaseHandler: base}
}

// ArchiveResult 归档操作结果
type ArchiveResult struct {
	ArchivedPath string `json:"archivedPath"`
	ArchivedAt   int64  `json:"archivedAt"`
}

// ArchiveFile 将文件归档到本地存储
func (h *ArchiveHandler) ArchiveFile(originalPath string) (*ArchiveResult, error) {
	// 检查源文件是否存在
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("source file not found: %s", originalPath)
	}

	// 读取源文件
	data, err := os.ReadFile(originalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read source file: %w", err)
	}

	// 确保 files 目录存在
	filesDir := h.Paths().FilesDir()
	if err := os.MkdirAll(filesDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create files directory: %w", err)
	}

	// 生成唯一文件名
	ext := filepath.Ext(originalPath)
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), randomString(6), ext)
	archivedPath := filepath.Join(filesDir, filename)

	// 写入文件
	if err := os.WriteFile(archivedPath, data, 0644); err != nil {
		return nil, fmt.Errorf("failed to archive file: %w", err)
	}

	return &ArchiveResult{
		ArchivedPath: "/files/" + filename,
		ArchivedAt:   time.Now().Unix(),
	}, nil
}

// UnarchiveFile 删除归档的本地副本
func (h *ArchiveHandler) UnarchiveFile(archivedPath string) error {
	if archivedPath == "" {
		return nil
	}

	// 构建完整路径
	fullPath := filepath.Join(h.Paths().DataPath(), strings.TrimPrefix(archivedPath, "/"))

	// 检查文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return nil // 文件已不存在，视为成功
	}

	// 删除文件
	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("failed to delete archived file: %w", err)
	}

	return nil
}

// SyncArchivedFile 从原始路径同步更新归档副本
func (h *ArchiveHandler) SyncArchivedFile(originalPath, archivedPath string) (*ArchiveResult, error) {
	// 检查源文件是否存在
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("source file not found: %s", originalPath)
	}

	// 读取源文件
	data, err := os.ReadFile(originalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read source file: %w", err)
	}

	// 构建归档文件完整路径
	fullArchivedPath := filepath.Join(h.Paths().DataPath(), strings.TrimPrefix(archivedPath, "/"))

	// 覆盖写入
	if err := os.WriteFile(fullArchivedPath, data, 0644); err != nil {
		return nil, fmt.Errorf("failed to sync archived file: %w", err)
	}

	return &ArchiveResult{
		ArchivedPath: archivedPath,
		ArchivedAt:   time.Now().Unix(),
	}, nil
}

// CheckFileExists 检查文件是否存在
func (h *ArchiveHandler) CheckFileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

// GetEffectiveFilePath 获取有效的文件路径（优先归档副本）
func (h *ArchiveHandler) GetEffectiveFilePath(originalPath, archivedPath string, archived bool) string {
	if archived && archivedPath != "" {
		// 优先使用归档副本
		fullArchivedPath := filepath.Join(h.Paths().DataPath(), strings.TrimPrefix(archivedPath, "/"))
		if _, err := os.Stat(fullArchivedPath); err == nil {
			return fullArchivedPath
		}
	}
	// 回退到原始路径
	return originalPath
}
