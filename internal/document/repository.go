package document

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"notion-lite/internal/constant"

	"github.com/google/uuid"
)

// Meta 文档元数据
type Meta struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	FolderId  string `json:"folderId,omitempty"`
	Order     int    `json:"order"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// Index 文档索引
type Index struct {
	Documents []Meta `json:"documents"`
	ActiveID  string `json:"activeId"`
}

// Repository 文档仓库
type Repository struct {
	dataPath string
}

// NewRepository 创建文档仓库
func NewRepository(dataPath string) *Repository {
	return &Repository{dataPath: dataPath}
}

// GetAll 获取文档列表
func (r *Repository) GetAll() (Index, error) {
	indexPath := filepath.Join(r.dataPath, "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			return Index{Documents: []Meta{}, ActiveID: ""}, nil
		}
		return Index{}, err
	}
	var index Index
	err = json.Unmarshal(data, &index)
	if index.Documents == nil {
		index.Documents = []Meta{}
	}
	return index, err
}

// Create 创建新文档
func (r *Repository) Create(title string) (Meta, error) {
	if title == "" {
		title = constant.DefaultNewDocTitle
	}
	now := time.Now().UnixMilli()
	doc := Meta{
		ID:        uuid.New().String(),
		Title:     title,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// 创建空文档文件
	docPath := filepath.Join(r.dataPath, "documents", doc.ID+".json")
	if err := os.WriteFile(docPath, []byte("[]"), 0644); err != nil {
		return Meta{}, err
	}

	// 更新索引
	index, err := r.GetAll()
	if err != nil {
		return Meta{}, err
	}
	index.Documents = append([]Meta{doc}, index.Documents...)
	index.ActiveID = doc.ID
	if err := r.saveIndex(index); err != nil {
		return Meta{}, err
	}

	return doc, nil
}

// Delete 删除文档
func (r *Repository) Delete(id string) error {
	// 删除文档文件
	docPath := filepath.Join(r.dataPath, "documents", id+".json")
	if err := os.Remove(docPath); err != nil && !os.IsNotExist(err) {
		return err
	}

	// 更新索引
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	newDocs := []Meta{}
	for _, d := range index.Documents {
		if d.ID != id {
			newDocs = append(newDocs, d)
		}
	}
	index.Documents = newDocs
	if index.ActiveID == id {
		if len(newDocs) > 0 {
			index.ActiveID = newDocs[0].ID
		} else {
			index.ActiveID = ""
		}
	}
	return r.saveIndex(index)
}

// Rename 重命名文档
func (r *Repository) Rename(id string, newTitle string) error {
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	for i, d := range index.Documents {
		if d.ID == id {
			index.Documents[i].Title = newTitle
			index.Documents[i].UpdatedAt = time.Now().UnixMilli()
			break
		}
	}
	return r.saveIndex(index)
}

// SetActive 设置当前活动文档
func (r *Repository) SetActive(id string) error {
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	index.ActiveID = id
	return r.saveIndex(index)
}

// UpdateTimestamp 更新文档时间戳
func (r *Repository) UpdateTimestamp(id string) error {
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	for i, d := range index.Documents {
		if d.ID == id {
			index.Documents[i].UpdatedAt = time.Now().UnixMilli()
			break
		}
	}
	return r.saveIndex(index)
}

// MoveToFolder 将文档移动到指定文件夹
func (r *Repository) MoveToFolder(docId string, folderId string) error {
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	for i, d := range index.Documents {
		if d.ID == docId {
			index.Documents[i].FolderId = folderId
			index.Documents[i].UpdatedAt = time.Now().UnixMilli()
			break
		}
	}
	return r.saveIndex(index)
}

func (r *Repository) saveIndex(index Index) error {
	indexPath := filepath.Join(r.dataPath, "index.json")
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(indexPath, data, 0644)
}

// Reorder 重新排序文档
func (r *Repository) Reorder(ids []string) error {
	index, err := r.GetAll()
	if err != nil {
		return err
	}
	// 创建 id -> order 映射
	orderMap := make(map[string]int)
	for i, id := range ids {
		orderMap[id] = i
	}
	// 更新每个文档的 Order 字段
	for i, d := range index.Documents {
		if order, ok := orderMap[d.ID]; ok {
			index.Documents[i].Order = order
		}
	}
	return r.saveIndex(index)
}
