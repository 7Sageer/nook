package handlers

import (
	"os"

	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"notion-lite/internal/tag"
	"notion-lite/internal/utils"
	"notion-lite/internal/watcher"
)

// TagHandler 标签与标签组处理器
type TagHandler struct {
	paths          *utils.PathBuilder
	docRepo        *document.Repository
	tagStore       *tag.Store
	folderRepo     *folder.Repository
	watcherService *watcher.Service
}

// NewTagHandler 创建标签处理器
func NewTagHandler(
	paths *utils.PathBuilder,
	docRepo *document.Repository,
	tagStore *tag.Store,
	folderRepo *folder.Repository,
	watcherService *watcher.Service,
) *TagHandler {
	return &TagHandler{
		paths:          paths,
		docRepo:        docRepo,
		tagStore:       tagStore,
		folderRepo:     folderRepo,
		watcherService: watcherService,
	}
}

// TagInfo 标签信息
type TagInfo struct {
	Name      string `json:"name"`
	Count     int    `json:"count"`
	Color     string `json:"color,omitempty"`
	IsPinned  bool   `json:"isPinned,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
}

// markIndexWrite 标记 index.json 即将被写入
func (h *TagHandler) markIndexWrite() {
	if h.watcherService != nil {
		indexPath := h.paths.Index()
		h.watcherService.MarkWrite(indexPath)
	}
}

// AddDocumentTag 为文档添加标签
func (h *TagHandler) AddDocumentTag(docId string, tagName string) error {
	h.markIndexWrite()
	return h.docRepo.AddTag(docId, tagName)
}

// RemoveDocumentTag 移除文档标签
func (h *TagHandler) RemoveDocumentTag(docId string, tagName string) error {
	h.markIndexWrite()
	return h.docRepo.RemoveTag(docId, tagName)
}

// GetAllTags 获取所有标签及其使用次数
func (h *TagHandler) GetAllTags() ([]TagInfo, error) {
	index, err := h.docRepo.GetAll()
	if err != nil {
		return nil, err
	}

	// 统计每个标签的使用次数
	tagCounts := make(map[string]int)
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			tagCounts[t]++
		}
	}

	// 构建结果，包含元数据
	result := make([]TagInfo, 0, len(tagCounts))
	for name, count := range tagCounts {
		meta, _ := h.tagStore.GetMeta(name)
		result = append(result, TagInfo{
			Name:      name,
			Count:     count,
			Color:     meta.Color,
			IsPinned:  meta.IsPinned,
			Collapsed: meta.Collapsed,
			Order:     meta.Order,
		})
	}

	return result, nil
}

// GetTagColors 获取所有标签颜色
func (h *TagHandler) GetTagColors() map[string]string {
	return h.tagStore.GetAllColors()
}

// SetTagColor 设置标签颜色
func (h *TagHandler) SetTagColor(tagName string, color string) error {
	return h.tagStore.SetColor(tagName, color)
}

// PinTag 固定标签到侧边栏
func (h *TagHandler) PinTag(tagName string) error {
	return h.tagStore.PinTag(tagName)
}

// SetPinnedTagCollapsed 设置固定标签折叠状态
func (h *TagHandler) SetPinnedTagCollapsed(name string, collapsed bool) error {
	return h.tagStore.SetPinnedTagCollapsed(name, collapsed)
}

// GetPinnedTags 获取所有固定标签
func (h *TagHandler) GetPinnedTags() []TagInfo {
	pinned := h.tagStore.GetAllPinnedTags()
	result := make([]TagInfo, len(pinned))
	for i, p := range pinned {
		result[i] = TagInfo{
			Name:      p.Name,
			Count:     p.Count,
			Color:     p.Color,
			IsPinned:  p.IsPinned,
			Collapsed: p.Collapsed,
			Order:     p.Order,
		}
	}
	return result
}

// ReorderPinnedTags 重新排序固定标签
func (h *TagHandler) ReorderPinnedTags(names []string) error {
	return h.tagStore.ReorderPinnedTags(names)
}

// RenameTag 重命名标签（同时更新所有文档）
func (h *TagHandler) RenameTag(oldName, newName string) error {
	// 同时更新所有文档中的标签名
	h.markIndexWrite()
	index, _ := h.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == oldName {
				_ = h.docRepo.RemoveTag(doc.ID, oldName)
				_ = h.docRepo.AddTag(doc.ID, newName)
				break
			}
		}
	}
	return h.tagStore.RenameTag(oldName, newName)
}

// UnpinTag 取消固定标签
func (h *TagHandler) UnpinTag(name string) error {
	return h.tagStore.UnpinTag(name)
}

// DeleteTag 删除标签（从所有文档中移除）
func (h *TagHandler) DeleteTag(name string) error {
	// 从所有文档中移除该标签
	h.markIndexWrite()
	index, _ := h.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == name {
				_ = h.docRepo.RemoveTag(doc.ID, name)
				break
			}
		}
	}
	return h.tagStore.DeleteTag(name)
}

// MigrateFoldersToTagGroups 将文件夹迁移为固定标签（一次性）
func (h *TagHandler) MigrateFoldersToTagGroups() {
	if h.folderRepo == nil {
		return
	}

	foldersPath := h.paths.Folders()

	if _, err := os.Stat(foldersPath); os.IsNotExist(err) {
		return
	}

	folders, err := h.folderRepo.GetAll()
	if err != nil || len(folders) == 0 {
		return
	}

	index, err := h.docRepo.GetAll()
	if err != nil {
		return
	}

	folderNameByID := make(map[string]string)
	for _, f := range folders {
		folderNameByID[f.ID] = f.Name
		_ = h.tagStore.PinTag(f.Name)
		if f.Collapsed {
			_ = h.tagStore.SetPinnedTagCollapsed(f.Name, true)
		}
	}

	for _, doc := range index.Documents {
		if doc.FolderId != "" {
			if folderName, ok := folderNameByID[doc.FolderId]; ok {
				_ = h.docRepo.AddTag(doc.ID, folderName)
				_ = h.docRepo.MoveToFolder(doc.ID, "")
			}
		}
	}

	groupNames := make([]string, len(folders))
	for i, f := range folders {
		groupNames[i] = f.Name
	}
	_ = h.tagStore.ReorderPinnedTags(groupNames)

	backupPath := foldersPath + ".bak"
	_ = os.Rename(foldersPath, backupPath)
}
