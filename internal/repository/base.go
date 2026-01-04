package repository

import (
	"encoding/json"
	"os"
)

// BaseRepository 提供基础的文件操作
type BaseRepository struct {
}

// LoadJSON 从文件加载 JSON 数据
// 如果文件不存在，返回 nil error，并将 v 指向的值保持不变 (或者期望调用者处理空状态)
// 为了兼容性，这里如果文件不存在，我们不返回 error，这符合当前代码库中 "如果文件不存在则创建一个空版本" 的逻辑
func (r *BaseRepository) LoadJSON(path string, v interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, v)
}

// SaveJSON 将数据保存为 JSON 文件
func (r *BaseRepository) SaveJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// FileExists 检查文件是否存在
func (r *BaseRepository) FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// DeleteFile 删除文件
func (r *BaseRepository) DeleteFile(path string) error {
	err := os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
