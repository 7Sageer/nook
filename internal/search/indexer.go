package search

import (
	"encoding/json"
	"strings"
	"sync"
)

// Index 内存倒排/正排索引
type Index struct {
	mu           sync.RWMutex
	contentCache map[string]string // docID -> pure text content
}

// NewIndex 创建新索引
func NewIndex() *Index {
	return &Index{
		contentCache: make(map[string]string),
	}
}

// InlineContent BlockNote 的 inline content 结构
type InlineContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
	Href string `json:"href,omitempty"` // for links
}

// Block 简化的 Block 结构，用于 JSON 解析
type Block struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Content  []InlineContent        `json:"content"` // BlockNote 的 content 是数组
	Children []Block                `json:"children"`
	Props    map[string]interface{} `json:"props"`
}

// Update 更新文档索引
func (i *Index) Update(docID string, jsonContent string) {
	text := ExtractTextFromBlocks(jsonContent)
	i.mu.Lock()
	defer i.mu.Unlock()
	i.contentCache[docID] = strings.ToLower(text)
}

// Remove 移除文档索引
func (i *Index) Remove(docID string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.contentCache, docID)
}

// Search 搜索内容
// 返回匹配的 docID 列表
func (i *Index) Search(query string) []string {
	if query == "" {
		return nil
	}
	query = strings.ToLower(query)

	i.mu.RLock()
	defer i.mu.RUnlock()

	var matches []string
	for docID, content := range i.contentCache {
		if strings.Contains(content, query) {
			matches = append(matches, docID)
		}
	}
	return matches
}

// GetContent 获取文档纯文本内容 (用于 snippet 提取)
func (i *Index) GetContent(docID string) string {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.contentCache[docID]
}

// ExtractTextFromBlocks 从 JSON 字符串中提取纯文本
func ExtractTextFromBlocks(jsonContent string) string {
	var blocks []Block
	if err := json.Unmarshal([]byte(jsonContent), &blocks); err != nil {
		// 如果解析失败，可能是空内容或者格式错误
		return ""
	}

	var sb strings.Builder
	extractTextRecursive(blocks, &sb)
	return sb.String()
}

func extractTextRecursive(blocks []Block, sb *strings.Builder) {
	for _, block := range blocks {
		// 提取 content 数组中的所有文本
		for _, inline := range block.Content {
			if inline.Text != "" {
				sb.WriteString(inline.Text)
				sb.WriteString(" ")
			}
		}

		if len(block.Children) > 0 {
			extractTextRecursive(block.Children, sb)
		}
	}
}

