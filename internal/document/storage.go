package document

import (
	"os"
	"path/filepath"
)

// Storage 文档存储
type Storage struct {
	dataPath string
}

// NewStorage 创建文档存储
func NewStorage(dataPath string) *Storage {
	return &Storage{dataPath: dataPath}
}

// Load 加载指定文档内容
func (s *Storage) Load(id string) (string, error) {
	docPath := filepath.Join(s.dataPath, "documents", id+".json")
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
	docPath := filepath.Join(s.dataPath, "documents", id+".json")
	return os.WriteFile(docPath, []byte(content), 0644)
}
