package document

import (
	"notion-lite/internal/utils"
	"os"
)

// Storage 文档存储
type Storage struct {
	paths *utils.PathBuilder
}

// NewStorage 创建文档存储
func NewStorage(paths *utils.PathBuilder) *Storage {
	return &Storage{paths: paths}
}

// Load 加载指定文档内容
func (s *Storage) Load(id string) (string, error) {
	docPath := s.paths.Document(id)
	data, err := os.ReadFile(docPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "[]", nil
		}
		return "", err
	}
	return string(data), nil
}

// Save 保存指定文档内容
func (s *Storage) Save(id string, content string) error {
	docPath := s.paths.Document(id)
	return os.WriteFile(docPath, []byte(content), 0644)
}
