package tag

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// TagMeta stores metadata for a tag
type TagMeta struct {
	Color string `json:"color"`
}

// Store manages tag metadata (colors)
type Store struct {
	mu       sync.RWMutex
	dataPath string
	Tags     map[string]TagMeta `json:"tags"`
}

// TagInfo represents a tag with its usage count
type TagInfo struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
	Color string `json:"color,omitempty"`
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

// SetColor sets the color for a tag
func (s *Store) SetColor(tagName string, color string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Tags[tagName] = TagMeta{Color: color}
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
