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

// Block 简化的 Block 结构，用于 JSON 解析
type Block struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Content  string                 `json:"content"` // HTML or text
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
		// 简单的提取 content 字段
		// 这里可以根据 block.Type 做更精细的处理，目前先提取所有 textual content
		if block.Content != "" {
			// 简单的去除 HTML 标签 (如果 content 是 HTML)
			// 这里假设 content 主要是纯文本或者简单的 HTML
			// 为了搜索准确，最好去除 HTML tags
			text := stripHTML(block.Content)
			sb.WriteString(text)
			sb.WriteString(" ")
		}

		if len(block.Children) > 0 {
			extractTextRecursive(block.Children, sb)
		}
	}
}

func stripHTML(input string) string {
	// 极简 HTML 去除，只为了搜索索引
	// 如果需要更复杂的，可以引入 external lib，但尽量保持 stdlib
	// 这里简单替换 <...> 为空格
	var sb strings.Builder
	inTag := false
	for _, r := range input {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			sb.WriteRune(' ') // 用空格代替标签，避免文字粘连
			continue
		}
		if !inTag {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}
