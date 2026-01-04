package tag

import (
	"notion-lite/internal/document"
	"notion-lite/internal/folder"
	"os"
	"sort"
)

// Service 标签业务逻辑服务
type Service struct {
	docRepo    *document.Repository
	store      *Store
	folderRepo *folder.Repository
	ragService RAGSearcher           // 用于语义搜索推荐 tag
	paths      PathProvider          // Optional, for cleaning up migration
}

// PathProvider defines methods to get paths
type PathProvider interface {
	Folders() string
}

// RAGSearcher RAG 搜索接口（避免循环依赖）
type RAGSearcher interface {
	SearchSimilarDocuments(docId string, limit int) ([]RAGDocumentResult, error)
}

// RAGDocumentResult 文档搜索结果
type RAGDocumentResult struct {
	DocID string
}

// NewService 创建标签服务
func NewService(
	docRepo *document.Repository,
	store *Store,
	folderRepo *folder.Repository,
	ragService RAGSearcher,
) *Service {
	return &Service{
		docRepo:    docRepo,
		store:      store,
		folderRepo: folderRepo,
		ragService: ragService,
	}
}

// SetPathProvider sets the path provider
func (s *Service) SetPathProvider(p PathProvider) {
	s.paths = p
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

// AddDocumentTag 为文档添加标签
func (s *Service) AddDocumentTag(docId string, tagName string) error {
	return s.docRepo.AddTag(docId, tagName)
}

// RemoveDocumentTag 移除文档标签
func (s *Service) RemoveDocumentTag(docId string, tagName string) error {
	return s.docRepo.RemoveTag(docId, tagName)
}

// GetAllTags 获取所有标签及其使用次数
func (s *Service) GetAllTags() ([]TagInfo, error) {
	index, err := s.docRepo.GetAll()
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
		meta, _ := s.store.GetMeta(name)
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

// RenameTag 重命名标签（同时更新所有文档）
func (s *Service) RenameTag(oldName, newName string) error {
	// 同时更新所有文档中的标签名
	index, _ := s.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == oldName {
				_ = s.docRepo.RemoveTag(doc.ID, oldName)
				_ = s.docRepo.AddTag(doc.ID, newName)
				break
			}
		}
	}
	return s.store.RenameTag(oldName, newName)
}

// DeleteTag 删除标签（从所有文档中移除）
func (s *Service) DeleteTag(name string) error {
	// 从所有文档中移除该标签
	index, _ := s.docRepo.GetAll()
	for _, doc := range index.Documents {
		for _, t := range doc.Tags {
			if t == name {
				_ = s.docRepo.RemoveTag(doc.ID, name)
				break
			}
		}
	}
	return s.store.DeleteTag(name)
}

// MigrateFoldersToTagGroups 将文件夹迁移为固定标签（一次性）
func (s *Service) MigrateFoldersToTagGroups() {
	if s.folderRepo == nil || s.paths == nil {
		return
	}

	foldersPath := s.paths.Folders()

	if _, err := os.Stat(foldersPath); os.IsNotExist(err) {
		return
	}

	folders, err := s.folderRepo.GetAll()
	if err != nil || len(folders) == 0 {
		return
	}

	index, err := s.docRepo.GetAll()
	if err != nil {
		return
	}

	folderNameByID := make(map[string]string)
	for _, f := range folders {
		folderNameByID[f.ID] = f.Name
		_ = s.store.PinTag(f.Name)
		if f.Collapsed {
			_ = s.store.SetPinnedTagCollapsed(f.Name, true)
		}
	}

	for _, doc := range index.Documents {
		if doc.FolderId != "" {
			if folderName, ok := folderNameByID[doc.FolderId]; ok {
				_ = s.docRepo.AddTag(doc.ID, folderName)
				_ = s.docRepo.MoveToFolder(doc.ID, "")
			}
		}
	}

	groupNames := make([]string, len(folders))
	for i, f := range folders {
		groupNames[i] = f.Name
	}
	_ = s.store.ReorderPinnedTags(groupNames)

	backupPath := foldersPath + ".bak"
	_ = os.Rename(foldersPath, backupPath)
}

// GetTagColors 获取所有标签颜色
func (s *Service) GetTagColors() map[string]string {
	return s.store.GetAllColors()
}

// SetTagColor 设置标签颜色
func (s *Service) SetTagColor(tagName string, color string) error {
	return s.store.SetColor(tagName, color)
}

// PinTag 固定标签
func (s *Service) PinTag(tagName string) error {
	return s.store.PinTag(tagName)
}

// UnpinTag 取消固定标签
func (s *Service) UnpinTag(tagName string) error {
	return s.store.UnpinTag(tagName)
}

// SetPinnedTagCollapsed 设置固定标签折叠状态
func (s *Service) SetPinnedTagCollapsed(name string, collapsed bool) error {
	return s.store.SetPinnedTagCollapsed(name, collapsed)
}

// GetPinnedTags 获取所有固定标签
func (s *Service) GetPinnedTags() []TagInfo {
	pinned := s.store.GetAllPinnedTags()
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
func (s *Service) ReorderPinnedTags(names []string) error {
	return s.store.ReorderPinnedTags(names)
}

// TagSuggestion 推荐的标签
type TagSuggestion struct {
	Name  string `json:"name"`
	Count int    `json:"count"` // 出现在多少个相似文档中
}

// SuggestTags 根据文档内容推荐标签
func (s *Service) SuggestTags(docId string, limit int) ([]TagSuggestion, error) {
	if s.ragService == nil {
		return nil, nil
	}

	// 获取当前文档信息
	index, err := s.docRepo.GetAll()
	if err != nil {
		return nil, err
	}

	// 找到当前文档及其已有 tags
	var currentTags []string
	for _, doc := range index.Documents {
		if doc.ID == docId {
			currentTags = doc.Tags
			break
		}
	}
	currentTagSet := make(map[string]bool)
	for _, t := range currentTags {
		currentTagSet[t] = true
	}

	// 搜索相似文档（排除当前文档）
	results, err := s.ragService.SearchSimilarDocuments(docId, 10)
	if err != nil {
		return nil, err
	}

	// 统计相似文档的 tags 频率
	tagCounts := make(map[string]int)
	for _, result := range results {
		for _, doc := range index.Documents {
			if doc.ID == result.DocID {
				for _, t := range doc.Tags {
					// 排除当前文档已有的 tags
					if !currentTagSet[t] {
						tagCounts[t]++
					}
				}
				break
			}
		}
	}

	// 转换为切片并按频率排序
	suggestions := make([]TagSuggestion, 0, len(tagCounts))
	for name, count := range tagCounts {
		suggestions = append(suggestions, TagSuggestion{
			Name:  name,
			Count: count,
		})
	}
	sort.Slice(suggestions, func(i, j int) bool {
		return suggestions[i].Count > suggestions[j].Count
	})

	// 限制返回数量
	if limit > 0 && len(suggestions) > limit {
		suggestions = suggestions[:limit]
	}

	return suggestions, nil
}
