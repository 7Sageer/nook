package tag

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// TagMeta stores metadata for a tag
type TagMeta struct {
	Color     string `json:"color,omitempty"`
	IsPinned  bool   `json:"isPinned,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
	// 兼容旧数据，加载时自动迁移
	IsGroup bool `json:"isGroup,omitempty"`
}

// Store manages tag metadata (colors)
type Store struct {
	mu       sync.RWMutex
	dataPath string
	Tags     map[string]TagMeta `json:"tags"`
}

// TagInfo represents a tag with its usage count
type TagInfo struct {
	Name      string `json:"name"`
	Count     int    `json:"count"`
	Color     string `json:"color,omitempty"`
	IsPinned  bool   `json:"isPinned,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
}

// NewStore creates a new tag store
func NewStore(dataPath string) *Store {
	s := &Store{
		dataPath: dataPath,
		Tags:     make(map[string]TagMeta),
	}
	s.load()
	return s
}

func (s *Store) filePath() string {
	return filepath.Join(s.dataPath, "tags.json")
}

func (s *Store) load() {
	data, err := os.ReadFile(s.filePath())
	if err != nil {
		return
	}
	var store struct {
		Tags map[string]TagMeta `json:"tags"`
	}
	if json.Unmarshal(data, &store) == nil && store.Tags != nil {
		s.Tags = store.Tags
		// 迁移旧数据：IsGroup -> IsPinned
		s.migrateIsGroupToIsPinned()
	}
}

// migrateIsGroupToIsPinned 将旧的 IsGroup 字段迁移到 IsPinned
func (s *Store) migrateIsGroupToIsPinned() {
	needSave := false
	for name, meta := range s.Tags {
		if meta.IsGroup && !meta.IsPinned {
			meta.IsPinned = true
			meta.IsGroup = false
			s.Tags[name] = meta
			needSave = true
		}
	}
	if needSave {
		_ = s.save()
	}
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(struct {
		Tags map[string]TagMeta `json:"tags"`
	}{Tags: s.Tags}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(), data, 0644)
}

// GetColor returns the color for a tag
func (s *Store) GetColor(tagName string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if meta, ok := s.Tags[tagName]; ok {
		return meta.Color
	}
	return ""
}

// SetColor sets the color for a tag, preserving other metadata
func (s *Store) SetColor(tagName string, color string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	meta := s.Tags[tagName]
	meta.Color = color
	s.Tags[tagName] = meta
	return s.save()
}

// GetAllColors returns all tag colors
func (s *Store) GetAllColors() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	colors := make(map[string]string)
	for name, meta := range s.Tags {
		if meta.Color != "" {
			colors[name] = meta.Color
		}
	}
	return colors
}

// PinTag 固定标签到侧边栏
func (s *Store) PinTag(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Find max order among pinned tags
	maxOrder := -1
	for _, meta := range s.Tags {
		if meta.IsPinned && meta.Order > maxOrder {
			maxOrder = meta.Order
		}
	}
	meta := s.Tags[name]
	meta.IsPinned = true
	meta.Collapsed = false
	meta.Order = maxOrder + 1
	s.Tags[name] = meta
	return s.save()
}

// SetPinnedTagCollapsed 设置固定标签的折叠状态
func (s *Store) SetPinnedTagCollapsed(name string, collapsed bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[name]; ok && meta.IsPinned {
		meta.Collapsed = collapsed
		s.Tags[name] = meta
		return s.save()
	}
	return nil
}

// GetAllPinnedTags 获取所有固定标签，按 order 排序
func (s *Store) GetAllPinnedTags() []TagInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	pinned := []TagInfo{}
	for name, meta := range s.Tags {
		if meta.IsPinned {
			pinned = append(pinned, TagInfo{
				Name:      name,
				Color:     meta.Color,
				IsPinned:  true,
				Collapsed: meta.Collapsed,
				Order:     meta.Order,
			})
		}
	}
	// Sort by order
	for i := 0; i < len(pinned)-1; i++ {
		for j := i + 1; j < len(pinned); j++ {
			if pinned[i].Order > pinned[j].Order {
				pinned[i], pinned[j] = pinned[j], pinned[i]
			}
		}
	}
	return pinned
}

// ReorderPinnedTags 重新排序固定标签
func (s *Store) ReorderPinnedTags(names []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, name := range names {
		if meta, ok := s.Tags[name]; ok && meta.IsPinned {
			meta.Order = i
			s.Tags[name] = meta
		}
	}
	return s.save()
}

// RenameTag 重命名标签（保留元数据）
func (s *Store) RenameTag(oldName, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[oldName]; ok {
		delete(s.Tags, oldName)
		s.Tags[newName] = meta
		return s.save()
	}
	return nil
}

// UnpinTag 取消固定标签
func (s *Store) UnpinTag(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[name]; ok && meta.IsPinned {
		meta.IsPinned = false
		meta.Collapsed = false
		meta.Order = 0
		s.Tags[name] = meta
		return s.save()
	}
	return nil
}

// DeleteTag 删除标签元数据
func (s *Store) DeleteTag(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.Tags[name]; ok {
		delete(s.Tags, name)
		return s.save()
	}
	return nil
}

// GetMeta returns full metadata for a tag
func (s *Store) GetMeta(name string) (TagMeta, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	meta, ok := s.Tags[name]
	return meta, ok
}
