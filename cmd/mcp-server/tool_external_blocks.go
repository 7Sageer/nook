package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/net/html"
)

// toolAddBookmark 添加书签块到文档
func (s *MCPServer) toolAddBookmark(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID        string `json:"doc_id"`
		URL          string `json:"url"`
		AfterBlockID string `json:"after_block_id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// 验证参数
	if params.URL == "" {
		return errorResult("url cannot be empty")
	}

	// 加载文档
	content, err := s.docStorage.Load(params.DocID)
	if err != nil {
		return errorResult("Document not found: " + params.DocID)
	}

	// 解析文档
	var blocks []interface{}
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return errorResult("Failed to parse document: " + err.Error())
	}

	// 获取书签元数据
	metadata, err := fetchBookmarkMetadata(params.URL)
	if err != nil {
		return errorResult("Failed to fetch bookmark metadata: " + err.Error())
	}

	// 创建书签块
	bookmarkBlock := map[string]interface{}{
		"id":   uuid.New().String(),
		"type": "bookmark",
		"props": map[string]interface{}{
			"textAlignment": "left",
			"url":           params.URL,
			"title":         metadata.Title,
			"description":   metadata.Description,
			"image":         metadata.Image,
			"favicon":       metadata.Favicon,
			"siteName":      metadata.SiteName,
			"loading":       false,
			"error":         "",
			"indexed":       false,
			"indexing":      false,
			"indexError":    "",
		},
		"content":  []interface{}{},
		"children": []interface{}{},
	}

	// 插入块
	blocks = insertBlock(blocks, bookmarkBlock, params.AfterBlockID)

	// 保存文档
	newContent, _ := json.Marshal(blocks)
	if err := s.docStorage.Save(params.DocID, string(newContent)); err != nil {
		return errorResult("Failed to save document: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.DocID)

	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.DocID) }()
	}

	return textResult(fmt.Sprintf("Bookmark added successfully (block_id: %s)", bookmarkBlock["id"]))
}

// toolAddFileReference 添加文件引用块到文档
func (s *MCPServer) toolAddFileReference(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID        string `json:"doc_id"`
		FilePath     string `json:"file_path"`
		AfterBlockID string `json:"after_block_id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// 验证参数
	if params.FilePath == "" {
		return errorResult("file_path cannot be empty")
	}

	// 验证文件是否存在
	fileInfo, err := os.Stat(params.FilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return errorResult("File not found: " + params.FilePath)
		}
		return errorResult("Failed to access file: " + err.Error())
	}

	if fileInfo.IsDir() {
		return errorResult("Path is a directory, not a file. Use add_folder_reference instead.")
	}

	// 加载文档
	content, err := s.docStorage.Load(params.DocID)
	if err != nil {
		return errorResult("Document not found: " + params.DocID)
	}

	// 解析文档
	var blocks []interface{}
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return errorResult("Failed to parse document: " + err.Error())
	}

	// 获取文件信息
	fileName := filepath.Base(params.FilePath)
	fileExt := strings.TrimPrefix(filepath.Ext(params.FilePath), ".")
	fileSize := fileInfo.Size()

	// 创建文件块
	fileBlock := map[string]interface{}{
		"id":   uuid.New().String(),
		"type": "file",
		"props": map[string]interface{}{
			"textAlignment": "left",
			"originalPath":  params.FilePath,
			"fileName":      fileName,
			"fileSize":      fileSize,
			"fileType":      fileExt,
			"mimeType":      "", // 可以后续扩展
			"archived":      false,
			"archivedPath":  "",
			"archivedAt":    0,
			"loading":       false,
			"error":         "",
			"fileMissing":   false,
			"indexed":       false,
			"indexing":      false,
			"indexError":    "",
			"filePath":      "", // deprecated
		},
		"content":  []interface{}{},
		"children": []interface{}{},
	}

	// 插入块
	blocks = insertBlock(blocks, fileBlock, params.AfterBlockID)

	// 保存文档
	newContent, _ := json.Marshal(blocks)
	if err := s.docStorage.Save(params.DocID, string(newContent)); err != nil {
		return errorResult("Failed to save document: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.DocID)

	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.DocID) }()
	}

	return textResult(fmt.Sprintf("File reference added successfully (block_id: %s, file: %s)", fileBlock["id"], fileName))
}

// toolAddFolderReference 添加文件夹引用块到文档
func (s *MCPServer) toolAddFolderReference(args json.RawMessage) ToolCallResult {
	var params struct {
		DocID        string `json:"doc_id"`
		FolderPath   string `json:"folder_path"`
		AfterBlockID string `json:"after_block_id"`
	}
	if err := json.Unmarshal(args, &params); err != nil {
		return errorResult("Invalid arguments: " + err.Error())
	}

	// 验证参数
	if params.FolderPath == "" {
		return errorResult("folder_path cannot be empty")
	}

	// 验证文件夹是否存在
	folderInfo, err := os.Stat(params.FolderPath)
	if err != nil {
		if os.IsNotExist(err) {
			return errorResult("Folder not found: " + params.FolderPath)
		}
		return errorResult("Failed to access folder: " + err.Error())
	}

	if !folderInfo.IsDir() {
		return errorResult("Path is a file, not a folder. Use add_file_reference instead.")
	}

	// 加载文档
	content, err := s.docStorage.Load(params.DocID)
	if err != nil {
		return errorResult("Document not found: " + params.DocID)
	}

	// 解析文档
	var blocks []interface{}
	if err := json.Unmarshal([]byte(content), &blocks); err != nil {
		return errorResult("Failed to parse document: " + err.Error())
	}

	// 获取文件夹信息
	folderName := filepath.Base(params.FolderPath)

	// 创建文件夹块
	folderBlock := map[string]interface{}{
		"id":   uuid.New().String(),
		"type": "folder",
		"props": map[string]interface{}{
			"textAlignment": "left",
			"folderPath":    params.FolderPath,
			"folderName":    folderName,
			"fileCount":     0,
			"indexedCount":  0,
			"loading":       false,
			"error":         "",
			"indexed":       false,
			"indexing":      false,
			"indexError":    "",
		},
		"content":  []interface{}{},
		"children": []interface{}{},
	}

	// 插入块
	blocks = insertBlock(blocks, folderBlock, params.AfterBlockID)

	// 保存文档
	newContent, _ := json.Marshal(blocks)
	if err := s.docStorage.Save(params.DocID, string(newContent)); err != nil {
		return errorResult("Failed to save document: " + err.Error())
	}
	_ = s.docRepo.UpdateTimestamp(params.DocID)

	// 触发 RAG 索引
	if s.ragService != nil {
		go func() { _ = s.ragService.IndexDocument(params.DocID) }()
	}

	return textResult(fmt.Sprintf("Folder reference added successfully (block_id: %s, folder: %s)", folderBlock["id"], folderName))
}

// insertBlock 在指定位置插入块
// 如果 afterBlockID 为空，追加到末尾
// 如果 afterBlockID 不为空，在该块后插入
func insertBlock(blocks []interface{}, newBlock interface{}, afterBlockID string) []interface{} {
	if afterBlockID == "" {
		// 追加到末尾
		return append(blocks, newBlock)
	}

	// 查找插入位置
	for i, block := range blocks {
		if blockMap, ok := block.(map[string]interface{}); ok {
			if id, ok := blockMap["id"].(string); ok && id == afterBlockID {
				// 在该块后插入
				result := make([]interface{}, 0, len(blocks)+1)
				result = append(result, blocks[:i+1]...)
				result = append(result, newBlock)
				result = append(result, blocks[i+1:]...)
				return result
			}
		}
	}

	// 如果没找到指定的块，追加到末尾
	return append(blocks, newBlock)
}

// BookmarkMetadata 书签元数据
type BookmarkMetadata struct {
	Title       string
	Description string
	Image       string
	Favicon     string
	SiteName    string
}

// fetchBookmarkMetadata 获取书签元数据
func fetchBookmarkMetadata(urlStr string) (*BookmarkMetadata, error) {
	// 创建HTTP客户端，设置超时
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// 发送HTTP请求
	resp, err := client.Get(urlStr)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	// 读取响应体（限制大小为5MB）
	body, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// 解析HTML
	doc, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// 提取元数据
	metadata := &BookmarkMetadata{
		Title:       urlStr, // 默认使用URL作为标题
		Description: "",
		Image:       "",
		Favicon:     "",
		SiteName:    "",
	}

	// 遍历HTML节点提取meta标签
	var traverse func(*html.Node)
	traverse = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "title":
				// 提取title标签
				if n.FirstChild != nil && metadata.Title == urlStr {
					metadata.Title = n.FirstChild.Data
				}
			case "meta":
				// 提取meta标签
				extractMetaTag(n, metadata)
			case "link":
				// 提取favicon
				extractFavicon(n, metadata, urlStr)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			traverse(c)
		}
	}
	traverse(doc)

	return metadata, nil
}

// extractMetaTag 从meta标签提取元数据
func extractMetaTag(n *html.Node, metadata *BookmarkMetadata) {
	var property, name, content string
	for _, attr := range n.Attr {
		switch attr.Key {
		case "property":
			property = attr.Val
		case "name":
			name = attr.Val
		case "content":
			content = attr.Val
		}
	}

	// Open Graph标签优先
	switch property {
	case "og:title":
		if metadata.Title != "" && !strings.HasPrefix(metadata.Title, "http") {
			// 如果已经有非URL的标题，保留
		} else {
			metadata.Title = content
		}
	case "og:description":
		metadata.Description = content
	case "og:image":
		metadata.Image = content
	case "og:site_name":
		metadata.SiteName = content
	}

	// 标准meta标签作为备选
	switch name {
	case "description":
		if metadata.Description == "" {
			metadata.Description = content
		}
	case "twitter:title":
		if metadata.Title == "" || strings.HasPrefix(metadata.Title, "http") {
			metadata.Title = content
		}
	case "twitter:description":
		if metadata.Description == "" {
			metadata.Description = content
		}
	case "twitter:image":
		if metadata.Image == "" {
			metadata.Image = content
		}
	}
}

// extractFavicon 提取favicon
func extractFavicon(n *html.Node, metadata *BookmarkMetadata, baseURL string) {
	var rel, href string
	for _, attr := range n.Attr {
		switch attr.Key {
		case "rel":
			rel = attr.Val
		case "href":
			href = attr.Val
		}
	}

	// 查找favicon链接
	if strings.Contains(rel, "icon") && href != "" {
		// 转换为绝对URL
		if strings.HasPrefix(href, "http") {
			metadata.Favicon = href
		} else {
			// 相对URL，需要拼接
			if parsedURL, err := url.Parse(baseURL); err == nil {
				if strings.HasPrefix(href, "/") {
					metadata.Favicon = parsedURL.Scheme + "://" + parsedURL.Host + href
				} else {
					metadata.Favicon = parsedURL.Scheme + "://" + parsedURL.Host + "/" + href
				}
			}
		}
	}
}
