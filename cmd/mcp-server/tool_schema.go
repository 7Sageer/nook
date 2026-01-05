package main

func (s *MCPServer) toolGetContentGuide() ToolCallResult {
	schema := `# BlockNote JSON Schema

Document content is a JSON array of blocks. Each block must have:
- "id": unique string (use UUID format, e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
- "type": block type string
- "props": object with block-specific properties
- "content": array of inline content (for text blocks)
- "children": array of nested blocks

## Block Types

### paragraph (default text block)
` + "```json" + `
{
  "id": "uuid",
  "type": "paragraph",
  "props": {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
  "content": [{"type": "text", "text": "Your text here", "styles": {}}],
  "children": []
}
` + "```" + `

### heading
` + "```json" + `
{
  "id": "uuid",
  "type": "heading",
  "props": {"level": 1, "textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
  "content": [{"type": "text", "text": "Heading text", "styles": {}}],
  "children": []
}
` + "```" + `
- level: 1, 2, or 3

### bulletListItem / numberedListItem
` + "```json" + `
{
  "id": "uuid",
  "type": "bulletListItem",
  "props": {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
  "content": [{"type": "text", "text": "List item", "styles": {}}],
  "children": []
}
` + "```" + `

### checkListItem
` + "```json" + `
{
  "id": "uuid",
  "type": "checkListItem",
  "props": {"checked": false, "textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
  "content": [{"type": "text", "text": "Todo item", "styles": {}}],
  "children": []
}
` + "```" + `

### codeBlock
` + "```json" + `
{
  "id": "uuid",
  "type": "codeBlock",
  "props": {"language": "javascript"},
  "content": [{"type": "text", "text": "const x = 1;", "styles": {}}],
  "children": []
}
` + "```" + `

### image
` + "```json" + `
{
  "id": "uuid",
  "type": "image",
  "props": {"url": "https://example.com/image.png", "caption": "", "width": 512},
  "content": [],
  "children": []
}
` + "```" + `

## Inline Content Styles

Text styles in "styles" object:
- "bold": true
- "italic": true
- "underline": true
- "strike": true
- "code": true
- "textColor": "red", "blue", "green", etc.
- "backgroundColor": "red", "blue", "green", etc.

## Example Document

` + "```json" + `
[
  {
    "id": "h1-uuid",
    "type": "heading",
    "props": {"level": 1, "textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
    "content": [{"type": "text", "text": "My Document", "styles": {}}],
    "children": []
  },
  {
    "id": "p1-uuid",
    "type": "paragraph",
    "props": {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
    "content": [
      {"type": "text", "text": "This is ", "styles": {}},
      {"type": "text", "text": "bold", "styles": {"bold": true}},
      {"type": "text", "text": " text.", "styles": }
    ],
    "children": []
  }
]
` + "```" + `

## Important Notes

1. Always generate unique UUIDs for each block's "id" field
2. "content" array can be empty for non-text blocks (like image)
3. "children" is used for nested blocks (indented content)
4. Default props can be omitted, but "id" and "type" are required`

	// 读取用户写作风格设置
	settings, err := s.settingsService.Get()
	writingStyle := ""
	if err == nil && settings.WritingStyle != "" {
		writingStyle = settings.WritingStyle
	} else {
		// 默认写作风格模板
		writingStyle = `## 语言偏好
- 默认使用中文
- 技术术语保留英文

## 格式约定
- 标题：使用 H2 作为主要章节标题
- 列表：优先使用无序列表
- 代码：标注语言类型

## 内容风格
- 简洁直接，避免冗余
- 使用主动语态`
	}

	// 拼接写作风格指南
	guide := schema + "\n\n---\n\n# Writing Style Guide\n\n" + writingStyle

	return textResult(guide)
}
