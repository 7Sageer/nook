package main

import (
	"encoding/json"
	"fmt"
	"time"
)

// 内容截断限制（约 10KB）
const maxContentLength = 10000

func (s *MCPServer) toolListDocuments(args json.RawMessage) ToolCallResult {
	var params struct {
		Offset int `json:"offset"`
		Limit  int `json:"limit"`
	}
	// 解析参数（可选）
	if len(args) > 0 {
		_ = json.Unmarshal(args, &params)
	}

	// 默认值和上限
	if params.Limit <= 0 {
		params.Limit = 50
	}
	if params.Limit > 100 {
		params.Limit = 100
	}

	index, err := s.docRepo.GetAll()
	if err != nil {
		return errorResult(err.Error())
	}

	// 分页处理
	total := len(index.Documents)
	start := params.Offset
	if start > total {
		start = total
	}
	end := start + params.Limit
	if end > total {
		end = total
	}

	// 构建分页结果
	type documentResponse struct {
		ID        string   `json:"id"`
		Title     string   `json:"title"`
		FolderId  string   `json:"folderId,omitempty"`
		Tags      []string `json:"tags,omitempty"`
		Order     int      `json:"order"`
		CreatedAt string   `json:"createdAt"`
		UpdatedAt string   `json:"updatedAt"`
	}

	type paginatedResult struct {
		Documents []documentResponse `json:"documents"`
		Total     int                `json:"total"`
		Offset    int                `json:"offset"`
		Limit     int                `json:"limit"`
	}

	docs := make([]documentResponse, 0, len(index.Documents[start:end]))
	for _, d := range index.Documents[start:end] {
		docs = append(docs, documentResponse{
			ID:        d.ID,
			Title:     d.Title,
			FolderId:  d.FolderId,
			Tags:      d.Tags,
			Order:     d.Order,
			CreatedAt: time.UnixMilli(d.CreatedAt).Format("2006-01-02"),
			UpdatedAt: time.UnixMilli(d.UpdatedAt).Format("2006-01-02"),
		})
	}

	result := paginatedResult{
		Documents: docs,
		Total:     total,
		Offset:    params.Offset,
		Limit:     params.Limit,
	}

	data, _ := json.MarshalIndent(result, "", "  ")
	return textResult(string(data))
}

func (s *MCPServer) toolGetDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	content, err := s.docStorage.Load(params.ID)
	if err != nil {
		return errorResult("Failed to load document: " + err.Error())
	}
	// 内容截断
	if len(content) > maxContentLength {
		content = content[:maxContentLength] + "\n... (truncated, total " + formatSize(len(content)) + ")"
	}
	return textResult(content)
}

// formatSize 格式化字节大小
func formatSize(bytes int) string {
	if bytes < 1024 {
		return fmt.Sprintf("%d bytes", bytes)
	}
	return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
}

// toolUpdateDocument 创建或更新文档（合并 create 和 update）
// 如果 id 不存在则创建新文档，存在则替换内容
func (s *MCPServer) toolUpdateDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID      string `json:"id"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// Validate BlockNote format
	if err := validateBlockNoteContent(params.Content); err != nil {
		return errorResult("Invalid BlockNote content: " + err.Error())
	}

	// 检查文档是否存在
	_, err := s.docStorage.Load(params.ID)
	isNew := err != nil

	if isNew {
		// 创建新文档
		doc, err := s.docRepo.CreateWithID(params.ID, "")
		if err != nil {
			return errorResult("Failed to create document: " + err.Error())
		}
		if err := s.docStorage.Save(doc.ID, params.Content); err != nil {
			return errorResult("Created but failed to save content: " + err.Error())
		}
		// 触发 RAG 索引
		if s.ragService != nil {
			go func() { _ = s.ragService.IndexDocument(doc.ID) }()
		}
		data, _ := json.MarshalIndent(doc, "", "  ")
		return textResult("Document created:\n" + string(data))
	}

	// 更新现有文档
	if err := s.docStorage.Save(params.ID, params.Content); err != nil {
		return errorResult("Failed to update: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.ID)
	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.ID) }()
	}
	return textResult("Document updated successfully")
}

func (s *MCPServer) toolDeleteDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if err := s.docRepo.Delete(params.ID); err != nil {
		return errorResult("Failed to delete: " + err.Error())
	}
	// 删除 RAG 向量索引
	if s.ragService != nil {
		go func() { _ = s.ragService.DeleteDocument(params.ID) }()
	}
	return textResult("Document deleted successfully")
}

func (s *MCPServer) toolRenameDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}
	if err := s.docRepo.Rename(params.ID, params.Title); err != nil {
		return errorResult("Failed to rename: " + err.Error())
	}
	return textResult("Document renamed successfully")
}

// toolEditDocument 使用 str_replace 方式编辑文档
// 在文档中搜索 old_text，替换为 new_text
func (s *MCPServer) toolEditDocument(args json.RawMessage) ToolCallResult {
	var params struct {
		ID      string `json:"id"`
		OldText string `json:"old_text"`
		NewText string `json:"new_text"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	if params.OldText == "" {
		return errorResult("old_text cannot be empty")
	}

	// 加载文档
	content, err := s.docStorage.Load(params.ID)
	if err != nil {
		return errorResult("Document not found: " + params.ID)
	}

	// 解析 BlockNote JSON
	var blocks []map[string]interface{}
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return errorResult("Failed to parse document: " + err.Error())
	}

	// 搜索并替换
	matchCount := 0
	blocks = replaceTextInBlocks(blocks, params.OldText, params.NewText, &matchCount)

	if matchCount == 0 {
		return errorResult("old_text not found in document")
	}
	if matchCount > 1 {
		return errorResult(fmt.Sprintf("old_text matches %d locations, must be unique", matchCount))
	}

	// 保存修改后的文档
	newContent, _ := json.Marshal(blocks)
	if err := s.docStorage.Save(params.ID, string(newContent)); err != nil {
		return errorResult("Failed to save: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.ID)

	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.ID) }()
	}

	return textResult("Document edited successfully")
}

// toolAppendContent 在文档末尾追加内容
func (s *MCPServer) toolAppendContent(args json.RawMessage) ToolCallResult {
	var params struct {
		ID      string `json:"id"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// 验证新内容格式
	if err := validateBlockNoteContent(params.Content); err != nil {
		return errorResult("Invalid BlockNote content: " + err.Error())
	}

	// 加载现有文档
	existingContent, err := s.docStorage.Load(params.ID)
	if err != nil {
		return errorResult("Document not found: " + params.ID)
	}

	// 解析现有内容和新内容
	var existingBlocks, newBlocks []interface{}
	if err := json.Unmarshal([]byte(existingContent), &existingBlocks); err != nil {
		return errorResult("Failed to parse existing document: " + err.Error())
	}
	if err := json.Unmarshal([]byte(params.Content), &newBlocks); err != nil {
		return errorResult("Failed to parse new content: " + err.Error())
	}

	// 追加新 blocks
	existingBlocks = append(existingBlocks, newBlocks...)

	// 保存
	merged, _ := json.Marshal(existingBlocks)
	if err := s.docStorage.Save(params.ID, string(merged)); err != nil {
		return errorResult("Failed to save: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.ID)

	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.ID) }()
	}

	return textResult(fmt.Sprintf("Appended %d blocks successfully", len(newBlocks)))
}
