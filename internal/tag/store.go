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
	IsGroup   bool   `json:"isGroup,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
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
	IsGroup   bool   `json:"isGroup,omitempty"`
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

// CreateGroup creates a new tag group
func (s *Store) CreateGroup(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Find max order
	maxOrder := -1
	for _, meta := range s.Tags {
		if meta.IsGroup && meta.Order > maxOrder {
			maxOrder = meta.Order
		}
	}
	s.Tags[name] = TagMeta{
		IsGroup:   true,
		Collapsed: false,
		Order:     maxOrder + 1,
	}
	return s.save()
}

// SetGroupCollapsed sets the collapsed state of a tag group
func (s *Store) SetGroupCollapsed(name string, collapsed bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[name]; ok && meta.IsGroup {
		meta.Collapsed = collapsed
		s.Tags[name] = meta
		return s.save()
	}
	return nil
}

// GetAllGroups returns all tag groups sorted by order
func (s *Store) GetAllGroups() []TagInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	groups := []TagInfo{}
	for name, meta := range s.Tags {
		if meta.IsGroup {
			groups = append(groups, TagInfo{
				Name:      name,
				Color:     meta.Color,
				IsGroup:   true,
				Collapsed: meta.Collapsed,
				Order:     meta.Order,
			})
		}
	}
	// Sort by order
	for i := 0; i < len(groups)-1; i++ {
		for j := i + 1; j < len(groups); j++ {
			if groups[i].Order > groups[j].Order {
				groups[i], groups[j] = groups[j], groups[i]
			}
		}
	}
	return groups
}

// ReorderGroups reorders tag groups by the given names
func (s *Store) ReorderGroups(names []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, name := range names {
		if meta, ok := s.Tags[name]; ok && meta.IsGroup {
			meta.Order = i
			s.Tags[name] = meta
		}
	}
	return s.save()
}

// RenameGroup renames a tag group
func (s *Store) RenameGroup(oldName, newName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[oldName]; ok && meta.IsGroup {
		delete(s.Tags, oldName)
		s.Tags[newName] = meta
		return s.save()
	}
	return nil
}

// DeleteGroup deletes a tag group
func (s *Store) DeleteGroup(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if meta, ok := s.Tags[name]; ok && meta.IsGroup {
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
