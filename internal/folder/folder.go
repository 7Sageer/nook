package folder

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

// Folder 文件夹结构
type Folder struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"createdAt"`
	Collapsed bool   `json:"collapsed"`
}

// Index 文件夹索引
type Index struct {
	Folders []Folder `json:"folders"`
}

// Repository 文件夹仓库
type Repository struct {
	dataPath string
}

// NewRepository 创建文件夹仓库
func NewRepository(dataPath string) *Repository {
	return &Repository{dataPath: dataPath}
}

func (r *Repository) indexPath() string {
	return filepath.Join(r.dataPath, "folders.json")
}

// GetAll 获取所有文件夹
func (r *Repository) GetAll() ([]Folder, error) {
	data, err := os.ReadFile(r.indexPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []Folder{}, nil
		}
		return nil, err
	}
	var index Index
	if err := json.Unmarshal(data, &index); err != nil {
		return []Folder{}, nil
	}
	if index.Folders == nil {
		return []Folder{}, nil
	}
	return index.Folders, nil
}

// Create 创建新文件夹
func (r *Repository) Create(name string) (Folder, error) {
	if name == "" {
		name = "新建文件夹"
	}
	folder := Folder{
		ID:        uuid.New().String(),
		Name:      name,
		CreatedAt: time.Now().UnixMilli(),
		Collapsed: false,
	}

	folders, _ := r.GetAll()
	folders = append([]Folder{folder}, folders...)
	if err := r.saveIndex(Index{Folders: folders}); err != nil {
		return Folder{}, err
	}
	return folder, nil
}

// Delete 删除文件夹
func (r *Repository) Delete(id string) error {
	folders, _ := r.GetAll()
	newFolders := []Folder{}
	for _, f := range folders {
		if f.ID != id {
			newFolders = append(newFolders, f)
		}
	}
	return r.saveIndex(Index{Folders: newFolders})
}

// Rename 重命名文件夹
func (r *Repository) Rename(id string, newName string) error {
	folders, _ := r.GetAll()
	for i, f := range folders {
		if f.ID == id {
			folders[i].Name = newName
			break
		}
	}
	return r.saveIndex(Index{Folders: folders})
}

// SetCollapsed 设置折叠状态
func (r *Repository) SetCollapsed(id string, collapsed bool) error {
	folders, _ := r.GetAll()
	for i, f := range folders {
		if f.ID == id {
			folders[i].Collapsed = collapsed
			break
		}
	}
	return r.saveIndex(Index{Folders: folders})
}

func (r *Repository) saveIndex(index Index) error {
	data, _ := json.MarshalIndent(index, "", "  ")
	return os.WriteFile(r.indexPath(), data, 0644)
}
