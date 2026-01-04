package handlers

import (
	"notion-lite/internal/tag"
)

// TagHandler 标签与标签组处理器
type TagHandler struct {
	*BaseHandler
	tagService *tag.Service
}

// NewTagHandler 创建标签处理器
func NewTagHandler(
	base *BaseHandler,
	tagService *tag.Service,
) *TagHandler {
	return &TagHandler{
		BaseHandler: base,
		tagService:  tagService,
	}
}

// TagInfo 标签信息
// Note: Aliasing internal type for Wails
type TagInfo = tag.TagInfo

// TagSuggestion 推荐的标签
type TagSuggestion = tag.TagSuggestion

// AddDocumentTag 为文档添加标签
func (h *TagHandler) AddDocumentTag(docId string, tagName string) error {
	h.MarkIndexWrite()
	return h.tagService.AddDocumentTag(docId, tagName)
}

// RemoveDocumentTag 移除文档标签
func (h *TagHandler) RemoveDocumentTag(docId string, tagName string) error {
	h.MarkIndexWrite()
	return h.tagService.RemoveDocumentTag(docId, tagName)
}

// GetAllTags 获取所有标签及其使用次数
func (h *TagHandler) GetAllTags() ([]TagInfo, error) {
	return h.tagService.GetAllTags()
}

// GetTagColors 获取所有标签颜色
func (h *TagHandler) GetTagColors() map[string]string {
	return h.tagService.GetTagColors()
}

// SetTagColor 设置标签颜色
func (h *TagHandler) SetTagColor(tagName string, color string) error {
	return h.tagService.SetTagColor(tagName, color)
}

// PinTag 固定标签到侧边栏
func (h *TagHandler) PinTag(tagName string) error {
	return h.tagService.PinTag(tagName)
}

// SetPinnedTagCollapsed 设置固定标签折叠状态
func (h *TagHandler) SetPinnedTagCollapsed(name string, collapsed bool) error {
	return h.tagService.SetPinnedTagCollapsed(name, collapsed)
}

// GetPinnedTags 获取所有固定标签
func (h *TagHandler) GetPinnedTags() []TagInfo {
	return h.tagService.GetPinnedTags()
}

// ReorderPinnedTags 重新排序固定标签
func (h *TagHandler) ReorderPinnedTags(names []string) error {
	return h.tagService.ReorderPinnedTags(names)
}

// RenameTag 重命名标签（同时更新所有文档）
func (h *TagHandler) RenameTag(oldName, newName string) error {
	h.MarkIndexWrite()
	return h.tagService.RenameTag(oldName, newName)
}

// UnpinTag 取消固定标签
func (h *TagHandler) UnpinTag(name string) error {
	return h.tagService.UnpinTag(name)
}

// DeleteTag 删除标签（从所有文档中移除）
func (h *TagHandler) DeleteTag(name string) error {
	h.MarkIndexWrite()
	return h.tagService.DeleteTag(name)
}

// MigrateFoldersToTagGroups 将文件夹迁移为固定标签（一次性）
func (h *TagHandler) MigrateFoldersToTagGroups() {
	// Set path provider to base handler which implements Paths()
	// Actually, service needs Paths() to locate folders dir if checking existence
	// I added `SetPathProvider` to Service.
	h.tagService.SetPathProvider(h.Paths())
	h.tagService.MigrateFoldersToTagGroups()
}

// SuggestTags 根据文档内容推荐标签
func (h *TagHandler) SuggestTags(docId string) ([]TagSuggestion, error) {
	return h.tagService.SuggestTags(docId, 5)
}
