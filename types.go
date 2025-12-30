package main

// ========== 前端专用数据结构 ==========

// SearchResult 搜索结果
type SearchResult struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// SemanticSearchResult 语义搜索结果（Chunk 级别）
type SemanticSearchResult struct {
	DocID     string  `json:"docId"`
	DocTitle  string  `json:"docTitle"`
	BlockID   string  `json:"blockId"`
	Content   string  `json:"content"`
	BlockType string  `json:"blockType"`
	Score     float32 `json:"score"`
}

// ChunkMatch 匹配的 chunk 信息
type ChunkMatch struct {
	BlockID        string  `json:"blockId"`
	Content        string  `json:"content"`
	BlockType      string  `json:"blockType"`
	HeadingContext string  `json:"headingContext"`
	Score          float32 `json:"score"`
}

// DocumentSearchResult 文档级搜索结果
type DocumentSearchResult struct {
	DocID         string       `json:"docId"`
	DocTitle      string       `json:"docTitle"`
	MaxScore      float32      `json:"maxScore"`
	MatchedChunks []ChunkMatch `json:"matchedChunks"`
}

// Settings 用户设置
type Settings struct {
	Theme        string `json:"theme"`
	Language     string `json:"language"`
	SidebarWidth int    `json:"sidebarWidth"` // 侧边栏宽度, 0 表示默认值
}

// EmbeddingConfig 嵌入模型配置（前端用）
type EmbeddingConfig struct {
	Provider     string `json:"provider"`
	BaseURL      string `json:"baseUrl"`
	Model        string `json:"model"`
	APIKey       string `json:"apiKey"`
	MaxChunkSize int    `json:"maxChunkSize"`
	Overlap      int    `json:"overlap"`
}

// RAGStatus RAG 索引状态
type RAGStatus struct {
	Enabled       bool   `json:"enabled"`
	IndexedDocs   int    `json:"indexedDocs"`
	TotalDocs     int    `json:"totalDocs"`
	LastIndexTime string `json:"lastIndexTime"`
}

// TagInfo 标签信息（包含使用次数和颜色）
type TagInfo struct {
	Name      string `json:"name"`
	Count     int    `json:"count"`
	Color     string `json:"color,omitempty"`
	IsGroup   bool   `json:"isGroup,omitempty"`
	Collapsed bool   `json:"collapsed,omitempty"`
	Order     int    `json:"order,omitempty"`
}

// ExternalFile 外部文件信息
type ExternalFile struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Content string `json:"content"`
}
