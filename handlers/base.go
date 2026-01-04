package handlers

import (
	"context"

	"notion-lite/internal/utils"
	"notion-lite/internal/watcher"
)

// BaseHandler 提供所有 handler 的公共功能
type BaseHandler struct {
	ctx            context.Context
	paths          *utils.PathBuilder
	watcherService *watcher.Service
}

// NewBaseHandler 创建基础处理器
func NewBaseHandler(
	paths *utils.PathBuilder,
	watcherService *watcher.Service,
) *BaseHandler {
	return &BaseHandler{
		paths:          paths,
		watcherService: watcherService,
	}
}

// SetContext 设置 Wails 上下文
func (b *BaseHandler) SetContext(ctx context.Context) {
	b.ctx = ctx
}

// Context 获取当前上下文
func (b *BaseHandler) Context() context.Context {
	return b.ctx
}

// Paths 获取路径构建器
func (b *BaseHandler) Paths() *utils.PathBuilder {
	return b.paths
}

// Watcher 获取文件监听服务
func (b *BaseHandler) Watcher() *watcher.Service {
	return b.watcherService
}

// MarkIndexWrite 标记 index.json 即将被写入
func (b *BaseHandler) MarkIndexWrite() {
	if b.watcherService != nil {
		b.watcherService.MarkWrite(b.paths.Index())
	}
}

// MarkFoldersWrite 标记 folders.json 即将被写入
func (b *BaseHandler) MarkFoldersWrite() {
	if b.watcherService != nil {
		b.watcherService.MarkWrite(b.paths.Folders())
	}
}

// MarkDocumentWrite 标记文档文件即将被写入
func (b *BaseHandler) MarkDocumentWrite(id string) {
	if b.watcherService != nil {
		b.watcherService.MarkWrite(b.paths.Document(id))
	}
}

// MarkSettingsWrite 标记 settings.json 即将被写入
func (b *BaseHandler) MarkSettingsWrite() {
	if b.watcherService != nil {
		b.watcherService.MarkWrite(b.paths.Settings())
	}
}

// MarkTagStoreWrite 标记 tags.json 即将被写入
func (b *BaseHandler) MarkTagStoreWrite() {
	if b.watcherService != nil {
		b.watcherService.MarkWrite(b.paths.TagStore())
	}
}
