package welcome

import (
	"encoding/json"
	"os"
	"time"

	"github.com/google/uuid"

	"notion-lite/internal/document"
	"notion-lite/internal/utils"
)

// WelcomeDocTitle 欢迎文档标题
const WelcomeDocTitle = "Welcome to Nook"

// Block BlockNote 块结构
type Block struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Props    map[string]interface{} `json:"props"`
	Content  []Content              `json:"content"`
	Children []Block                `json:"children"`
}

// Content 块内容
type Content struct {
	Type   string            `json:"type"`
	Text   string            `json:"text"`
	Styles map[string]string `json:"styles"`
}

// defaultProps 默认块属性
func defaultProps() map[string]interface{} {
	return map[string]interface{}{
		"backgroundColor": "default",
		"textColor":       "default",
		"textAlignment":   "left",
	}
}

// headingProps 标题块属性
func headingProps(level int) map[string]interface{} {
	props := defaultProps()
	props["level"] = level
	props["isToggleable"] = false
	return props
}

// newBlock 创建新块
func newBlock(blockType string, props map[string]interface{}, text string) Block {
	content := []Content{}
	if text != "" {
		content = append(content, Content{
			Type:   "text",
			Text:   text,
			Styles: map[string]string{},
		})
	}
	return Block{
		ID:       uuid.New().String(),
		Type:     blockType,
		Props:    props,
		Content:  content,
		Children: []Block{},
	}
}

// bulletProps 列表项属性
func bulletProps() map[string]interface{} {
	return map[string]interface{}{
		"backgroundColor": "default",
		"textColor":       "default",
		"textAlignment":   "left",
	}
}

// generateWelcomeContent 生成欢迎文档内容
func generateWelcomeContent() []Block {
	blocks := []Block{
		// H1: Welcome to Nook
		newBlock("heading", headingProps(1), WelcomeDocTitle),
		newBlock("paragraph", defaultProps(), "The missing memory layer for your AI workflow. Gather, index, and connect your knowledge."),
		newBlock("paragraph", defaultProps(), ""),

		// Gather
		newBlock("heading", headingProps(2), "Gather"),
		newBlock("paragraph", defaultProps(), "Nook indexes your files where they are. Use these external blocks:"),
		newBlock("bulletListItem", bulletProps(), "Bookmark - Paste a URL to save web content (not just the link)"),
		newBlock("bulletListItem", bulletProps(), "File - Reference local files (PDF, code, documents)"),
		newBlock("bulletListItem", bulletProps(), "Folder - Index entire directories"),
		newBlock("paragraph", defaultProps(), "Tip: Drag files/folders directly into the editor, or paste links to create bookmarks."),
		newBlock("paragraph", defaultProps(), ""),

		// Index
		newBlock("heading", headingProps(2), "Index"),
		newBlock("paragraph", defaultProps(), "Enable semantic search by configuring your embedding provider in Settings."),
		newBlock("paragraph", defaultProps(), "Once configured, Nook will automatically generate vector embeddings for all your content."),
		newBlock("paragraph", defaultProps(), ""),

		// Connect
		newBlock("heading", headingProps(2), "Connect"),
		newBlock("paragraph", defaultProps(), "Nook acts as an MCP server. Connect it to Claude, Raycast, or Cursor:"),
		newBlock("bulletListItem", bulletProps(), "Open Settings → MCP Integration"),
		newBlock("bulletListItem", bulletProps(), "Copy the configuration JSON"),
		newBlock("bulletListItem", bulletProps(), "Paste into your AI tool's MCP settings"),
		newBlock("paragraph", defaultProps(), ""),

		// Organize
		newBlock("heading", headingProps(2), "Organize"),
		newBlock("paragraph", defaultProps(), "Use tags to organize your documents. Click the tag icon in the sidebar to manage tags."),
		newBlock("paragraph", defaultProps(), ""),
	}
	return blocks
}

// CreateWelcomeDocument 创建欢迎文档
func CreateWelcomeDocument(paths *utils.PathBuilder, docRepo *document.Repository, docStorage *document.Storage) error {
	// 检查是否已有文档
	index, err := docRepo.GetAll()
	if err == nil && len(index.Documents) > 0 {
		return nil // 已有文档，不创建欢迎文档
	}

	// 创建文档元数据
	now := time.Now().UnixMilli()
	docID := uuid.New().String()
	doc := document.Meta{
		ID:        docID,
		Title:     WelcomeDocTitle,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// 生成欢迎内容
	content := generateWelcomeContent()
	contentJSON, err := json.Marshal(content)
	if err != nil {
		return err
	}

	// 保存文档内容
	if err := docStorage.Save(docID, string(contentJSON)); err != nil {
		return err
	}

	// 更新索引
	index.Documents = append([]document.Meta{doc}, index.Documents...)
	index.ActiveID = docID

	// 直接保存索引（使用 repository 的内部方法）
	return saveIndex(paths, index)
}

// saveIndex 保存索引文件
func saveIndex(paths *utils.PathBuilder, index document.Index) error {
	indexPath := paths.Index()
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}
	return writeFile(indexPath, data)
}

// writeFile 写入文件
func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}
