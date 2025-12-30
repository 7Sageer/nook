package handlers

import (
	"path/filepath"

	"notion-lite/internal/document"
	"notion-lite/internal/tag"
	"notion-lite/internal/watcher"
)

// TagHandler 标签与标签组处理器
type TagHandler struct {
	dataPath       string
	docRepo        *document.Repository
	tagStore       *tag.Store
	watcherService *watcher.Service
}

// NewTagHandler 创建标签处理器
func NewTagHandler(
	dataPath string,
	docRepo *document.Repository,
	tagStore *tag.Store,
	watcherService *watcher.Service,
) *TagHandler {
	return &TagHandler{
		dataPath:       dataPath,
		docRepo:        docRepo,
		tagStore:       tagStore,
		watcherService: watcherService,
	}
}

// TagInfo 标签信息
type TagInfo struct {
	Name      string `json:"name"`
	Count     int    `json:"count"`
	Color     string `json:"color,omitempty"`
	IsGroup   bool   `json:"isGroup,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
}

// markIndexWrite 标记 index.json 即将被写入
func (h *TagHandler) markIndexWrite() {
	if h.watcherService != nil {
		indexPath := filepath.Join(h.dataPath, "index.json")
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
			IsGroup:   meta.IsGroup,
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

// CreateTagGroup 创建新标签组
func (h *TagHandler) CreateTagGroup(name string) error {
	return h.tagStore.CreateGroup(name)
}

// SetTagGroupCollapsed 设置标签组折叠状态
func (h *TagHandler) SetTagGroupCollapsed(name string, collapsed bool) error {
	return h.tagStore.SetGroupCollapsed(name, collapsed)
}

// GetTagGroups 获取所有标签组
func (h *TagHandler) GetTagGroups() []TagInfo {
	groups := h.tagStore.GetAllGroups()
	result := make([]TagInfo, len(groups))
	for i, g := range groups {
		result[i] = TagInfo{
			Name:      g.Name,
			Count:     g.Count,
			Color:     g.Color,
			IsGroup:   g.IsGroup,
			Collapsed: g.Collapsed,
			Order:     g.Order,
		}
	}
	return result
}

// ReorderTagGroups 重新排序标签组
func (h *TagHandler) ReorderTagGroups(names []string) error {
	return h.tagStore.ReorderGroups(names)
}

// RenameTagGroup 重命名标签组
func (h *TagHandler) RenameTagGroup(oldName, newName string) error {
	// 同时更新所有文档中的标签名
	index, _ := h.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == oldName {
				h.docRepo.RemoveTag(doc.ID, oldName)
				h.docRepo.AddTag(doc.ID, newName)
				break
			}
		}
	}
	return h.tagStore.RenameGroup(oldName, newName)
}

// DeleteTagGroup 删除标签组
func (h *TagHandler) DeleteTagGroup(name string) error {
	// 从所有文档中移除该标签
	index, _ := h.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == name {
				h.docRepo.RemoveTag(doc.ID, name)
				break
			}
		}
	}
	return h.tagStore.DeleteGroup(name)
}
