# RAG MVP 实现文档

## 1. 概述

### 1.1 目标

为 Nook 添加语义搜索能力，通过 MCP Server 暴露给外部 AI 工具（如 Claude Code）调用，实现基于自然语言的文档检索。

### 1.2 MVP 范围

**包含：**
- 块级文档内容索引
- 语义搜索 API（通过 MCP）
- 支持 Ollama（本地）和 OpenAI 兼容 API
- 自定义 base URL 配置

**不包含：**
- 应用内对话 UI（ChatPanel）
- 嵌入文件/链接内容索引
- 实时索引更新（需手动触发）

### 1.3 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 向量存储 | sqlite-vec | 轻量、纯 Go 集成、无外部依赖 |
| Embedding | Ollama / OpenAI | 本地优先，可选云端 |
| 索引粒度 | 块级（Block） | 匹配 BlockNote 数据结构，检索精确 |
| 暴露方式 | MCP Server | 复用现有基础设施，无需前端开发 |

---

## 2. 技术架构

### 2.1 整体架构图

```
┌────────────────────────────────────────────────────┐
│              External AI (Claude Code)             │
└───────────────────────┬────────────────────────────┘
                        │ JSON-RPC (stdio)
                        ▼
┌────────────────────────────────────────────────────┐
│                 MCP Server                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ 现有 Tools                                    │  │
│  │ - search_documents (关键词搜索)              │  │
│  │ - get_document / list_documents ...          │  │
│  ├──────────────────────────────────────────────┤  │
│  │ 新增 Tools                                    │  │
│  │ - semantic_search (语义搜索)                  │  │
│  │ - reindex_documents (重建索引)                │  │
│  │ - get_rag_config / set_rag_config            │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────┐
│              internal/rag/                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   Indexer   │  │  Searcher   │  │ Embedding │  │
│  │  (索引管理) │  │ (向量检索)  │  │  Client   │  │
│  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│         └────────────────┼───────────────┘        │
│                          ▼                        │
│              ┌───────────────────┐                │
│              │   VectorStore     │                │
│              │   (sqlite-vec)    │                │
│              │ ~/.Nook/vectors.db│                │
│              └───────────────────┘                │
└────────────────────────────────────────────────────┘
```

### 2.2 数据流

#### 索引流程
```
文档保存 → 提取块内容 → 生成 Embedding → 存入向量数据库
```

#### 搜索流程
```
用户查询 → 生成查询 Embedding → 向量相似度搜索 → 返回相关块及上下文
```

---

## 3. 模块设计

### 3.1 目录结构

```
internal/rag/
├── config.go       # 配置结构和持久化
├── embedding.go    # Embedding 客户端接口和实现
├── store.go        # sqlite-vec 向量存储
├── indexer.go      # 索引管理（增量/全量）
├── searcher.go     # 语义搜索逻辑
└── rag.go          # 统一入口，组合各模块
```

### 3.2 config.go - 配置管理

```go
package rag

import (
    "encoding/json"
    "os"
    "path/filepath"
)

// EmbeddingConfig 嵌入模型配置
type EmbeddingConfig struct {
    Provider string `json:"provider"` // "ollama" | "openai"
    BaseURL  string `json:"baseUrl"`  // API 地址
    Model    string `json:"model"`    // 模型名称
    APIKey   string `json:"apiKey"`   // API 密钥（OpenAI 需要）
}

// DefaultConfig 默认配置（Ollama 本地）
var DefaultConfig = EmbeddingConfig{
    Provider: "ollama",
    BaseURL:  "http://localhost:11434",
    Model:    "nomic-embed-text",
}

// LoadConfig 从文件加载配置
func LoadConfig(dataDir string) (*EmbeddingConfig, error) {
    path := filepath.Join(dataDir, "rag_config.json")
    data, err := os.ReadFile(path)
    if err != nil {
        if os.IsNotExist(err) {
            return &DefaultConfig, nil
        }
        return nil, err
    }
    var config EmbeddingConfig
    if err := json.Unmarshal(data, &config); err != nil {
        return nil, err
    }
    return &config, nil
}

// SaveConfig 保存配置到文件
func SaveConfig(dataDir string, config *EmbeddingConfig) error {
    path := filepath.Join(dataDir, "rag_config.json")
    data, err := json.MarshalIndent(config, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(path, data, 0644)
}
```

### 3.3 embedding.go - Embedding 客户端

```go
package rag

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

// EmbeddingClient 嵌入向量生成接口
type EmbeddingClient interface {
    Embed(text string) ([]float32, error)
    EmbedBatch(texts []string) ([][]float32, error)
    Dimension() int
}

// NewEmbeddingClient 根据配置创建客户端
func NewEmbeddingClient(config *EmbeddingConfig) (EmbeddingClient, error) {
    switch config.Provider {
    case "ollama":
        return NewOllamaClient(config.BaseURL, config.Model), nil
    case "openai":
        return NewOpenAIClient(config.BaseURL, config.Model, config.APIKey), nil
    default:
        return nil, fmt.Errorf("unknown provider: %s", config.Provider)
    }
}

// ========== Ollama 实现 ==========

type OllamaClient struct {
    baseURL string
    model   string
    client  *http.Client
}

func NewOllamaClient(baseURL, model string) *OllamaClient {
    return &OllamaClient{
        baseURL: baseURL,
        model:   model,
        client:  &http.Client{},
    }
}

func (c *OllamaClient) Embed(text string) ([]float32, error) {
    reqBody := map[string]interface{}{
        "model":  c.model,
        "prompt": text,
    }
    body, _ := json.Marshal(reqBody)

    resp, err := c.client.Post(
        c.baseURL+"/api/embeddings",
        "application/json",
        bytes.NewReader(body),
    )
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Embedding []float32 `json:"embedding"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return result.Embedding, nil
}

func (c *OllamaClient) EmbedBatch(texts []string) ([][]float32, error) {
    // Ollama 不支持批量，逐个处理
    results := make([][]float32, len(texts))
    for i, text := range texts {
        emb, err := c.Embed(text)
        if err != nil {
            return nil, err
        }
        results[i] = emb
    }
    return results, nil
}

func (c *OllamaClient) Dimension() int {
    return 768 // nomic-embed-text 默认维度
}

// ========== OpenAI 兼容实现 ==========

type OpenAIClient struct {
    baseURL string
    model   string
    apiKey  string
    client  *http.Client
}

func NewOpenAIClient(baseURL, model, apiKey string) *OpenAIClient {
    if baseURL == "" {
        baseURL = "https://api.openai.com/v1"
    }
    return &OpenAIClient{
        baseURL: baseURL,
        model:   model,
        apiKey:  apiKey,
        client:  &http.Client{},
    }
}

func (c *OpenAIClient) Embed(text string) ([]float32, error) {
    embeddings, err := c.EmbedBatch([]string{text})
    if err != nil {
        return nil, err
    }
    return embeddings[0], nil
}

func (c *OpenAIClient) EmbedBatch(texts []string) ([][]float32, error) {
    reqBody := map[string]interface{}{
        "model": c.model,
        "input": texts,
    }
    body, _ := json.Marshal(reqBody)

    req, _ := http.NewRequest("POST", c.baseURL+"/embeddings", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+c.apiKey)

    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Data []struct {
            Embedding []float32 `json:"embedding"`
        } `json:"data"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    embeddings := make([][]float32, len(result.Data))
    for i, d := range result.Data {
        embeddings[i] = d.Embedding
    }
    return embeddings, nil
}

func (c *OpenAIClient) Dimension() int {
    return 1536 // text-embedding-ada-002 默认维度
}
```

### 3.4 store.go - 向量存储

```go
package rag

import (
    "database/sql"
    _ "github.com/asg017/sqlite-vec-go-bindings/cgo"
)

// BlockVector 块向量记录
type BlockVector struct {
    ID        string    // block_id
    DocID     string    // 所属文档 ID
    Content   string    // 块的纯文本内容
    BlockType string    // paragraph, heading, list 等
    Embedding []float32 // 向量
}

// VectorStore 向量存储接口
type VectorStore struct {
    db        *sql.DB
    dimension int
}

// NewVectorStore 创建向量存储
func NewVectorStore(dbPath string, dimension int) (*VectorStore, error) {
    db, err := sql.Open("sqlite3", dbPath)
    if err != nil {
        return nil, err
    }

    store := &VectorStore{db: db, dimension: dimension}
    if err := store.initSchema(); err != nil {
        return nil, err
    }
    return store, nil
}

func (s *VectorStore) initSchema() error {
    // 创建元数据表
    _, err := s.db.Exec(`
        CREATE TABLE IF NOT EXISTS block_vectors (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            content TEXT NOT NULL,
            block_type TEXT,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_doc_id ON block_vectors(doc_id);
    `)
    if err != nil {
        return err
    }

    // 创建 sqlite-vec 虚拟表
    _, err = s.db.Exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_blocks USING vec0(
            id TEXT PRIMARY KEY,
            embedding FLOAT[?]
        );
    `, s.dimension)
    return err
}

// Upsert 插入或更新块向量
func (s *VectorStore) Upsert(block *BlockVector) error {
    tx, _ := s.db.Begin()
    defer tx.Rollback()

    // 更新元数据
    _, err := tx.Exec(`
        INSERT OR REPLACE INTO block_vectors (id, doc_id, content, block_type)
        VALUES (?, ?, ?, ?)
    `, block.ID, block.DocID, block.Content, block.BlockType)
    if err != nil {
        return err
    }

    // 更新向量
    _, err = tx.Exec(`
        INSERT OR REPLACE INTO vec_blocks (id, embedding)
        VALUES (?, ?)
    `, block.ID, serializeVector(block.Embedding))
    if err != nil {
        return err
    }

    return tx.Commit()
}

// DeleteByDocID 删除文档的所有块向量
func (s *VectorStore) DeleteByDocID(docID string) error {
    tx, _ := s.db.Begin()
    defer tx.Rollback()

    // 获取要删除的 block IDs
    rows, _ := tx.Query("SELECT id FROM block_vectors WHERE doc_id = ?", docID)
    var ids []string
    for rows.Next() {
        var id string
        rows.Scan(&id)
        ids = append(ids, id)
    }
    rows.Close()

    // 删除向量和元数据
    for _, id := range ids {
        tx.Exec("DELETE FROM vec_blocks WHERE id = ?", id)
        tx.Exec("DELETE FROM block_vectors WHERE id = ?", id)
    }

    return tx.Commit()
}

// Search 向量相似度搜索
func (s *VectorStore) Search(queryVec []float32, limit int) ([]SearchResult, error) {
    rows, err := s.db.Query(`
        SELECT v.id, v.distance, b.doc_id, b.content, b.block_type
        FROM vec_blocks v
        JOIN block_vectors b ON v.id = b.id
        WHERE v.embedding MATCH ?
        ORDER BY v.distance
        LIMIT ?
    `, serializeVector(queryVec), limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var results []SearchResult
    for rows.Next() {
        var r SearchResult
        rows.Scan(&r.BlockID, &r.Distance, &r.DocID, &r.Content, &r.BlockType)
        results = append(results, r)
    }
    return results, nil
}

// SearchResult 搜索结果
type SearchResult struct {
    BlockID   string  `json:"blockId"`
    DocID     string  `json:"docId"`
    Content   string  `json:"content"`
    BlockType string  `json:"blockType"`
    Distance  float32 `json:"distance"`
}
```

### 3.5 indexer.go - 索引管理

```go
package rag

// Indexer 文档索引器
type Indexer struct {
    store    *VectorStore
    embedder EmbeddingClient
    docRepo  DocumentRepository // 复用现有的文档仓库接口
}

// IndexDocument 索引单个文档
func (idx *Indexer) IndexDocument(docID string) error {
    // 1. 加载文档内容
    content, err := idx.docRepo.LoadContent(docID)
    if err != nil {
        return err
    }

    // 2. 删除旧的索引
    idx.store.DeleteByDocID(docID)

    // 3. 提取块并生成向量
    blocks := extractBlocks(content)
    for _, block := range blocks {
        if block.Content == "" {
            continue
        }
        embedding, err := idx.embedder.Embed(block.Content)
        if err != nil {
            return err
        }
        idx.store.Upsert(&BlockVector{
            ID:        block.ID,
            DocID:     docID,
            Content:   block.Content,
            BlockType: block.Type,
            Embedding: embedding,
        })
    }
    return nil
}

// ReindexAll 重建所有文档索引
func (idx *Indexer) ReindexAll() (int, error) {
    docs, _ := idx.docRepo.List()
    count := 0
    for _, doc := range docs {
        if err := idx.IndexDocument(doc.ID); err != nil {
            continue // 跳过失败的文档
        }
        count++
    }
    return count, nil
}
```

### 3.6 searcher.go - 语义搜索

```go
package rag

// Searcher 语义搜索器
type Searcher struct {
    store    *VectorStore
    embedder EmbeddingClient
    docRepo  DocumentRepository
}

// SemanticSearchResult 搜索结果（包含文档标题）
type SemanticSearchResult struct {
    DocID     string  `json:"docId"`
    DocTitle  string  `json:"docTitle"`
    BlockID   string  `json:"blockId"`
    Content   string  `json:"content"`
    BlockType string  `json:"blockType"`
    Score     float32 `json:"score"` // 相似度分数 (0-1)
}

// Search 执行语义搜索
func (s *Searcher) Search(query string, limit int) ([]SemanticSearchResult, error) {
    // 1. 生成查询向量
    queryVec, err := s.embedder.Embed(query)
    if err != nil {
        return nil, err
    }

    // 2. 向量搜索
    results, err := s.store.Search(queryVec, limit)
    if err != nil {
        return nil, err
    }

    // 3. 补充文档标题
    output := make([]SemanticSearchResult, len(results))
    for i, r := range results {
        doc, _ := s.docRepo.Get(r.DocID)
        output[i] = SemanticSearchResult{
            DocID:     r.DocID,
            DocTitle:  doc.Title,
            BlockID:   r.BlockID,
            Content:   r.Content,
            BlockType: r.BlockType,
            Score:     1 - r.Distance, // 距离转相似度
        }
    }
    return output, nil
}
```

---

## 4. 数据模型

### 4.1 数据库 Schema

文件位置：`~/.Nook/vectors.db`

```sql
-- 块元数据表
CREATE TABLE block_vectors (
    id TEXT PRIMARY KEY,              -- BlockNote block ID
    doc_id TEXT NOT NULL,             -- 所属文档 ID
    content TEXT NOT NULL,            -- 块的纯文本内容
    block_type TEXT,                  -- paragraph, heading, bulletListItem 等
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_block_doc_id ON block_vectors(doc_id);

-- sqlite-vec 向量虚拟表
CREATE VIRTUAL TABLE vec_blocks USING vec0(
    id TEXT PRIMARY KEY,
    embedding FLOAT[768]              -- 维度根据模型调整
);

-- 索引状态表（可选，用于增量索引）
CREATE TABLE index_status (
    doc_id TEXT PRIMARY KEY,
    content_hash TEXT,                -- 文档内容哈希，检测变化
    indexed_at INTEGER
);
```

### 4.2 配置文件格式

文件位置：`~/.Nook/rag_config.json`

```json
{
  "provider": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "nomic-embed-text",
  "apiKey": ""
}
```

### 4.3 BlockNote 块提取

从 BlockNote JSON 提取可索引文本：

```go
// extractBlocks 从 BlockNote 内容提取块
func extractBlocks(content []byte) []ExtractedBlock {
    var blocks []map[string]interface{}
    json.Unmarshal(content, &blocks)

    var result []ExtractedBlock
    for _, block := range blocks {
        extracted := ExtractedBlock{
            ID:   block["id"].(string),
            Type: block["type"].(string),
        }
        // 提取文本内容
        if content, ok := block["content"].([]interface{}); ok {
            extracted.Content = extractTextFromContent(content)
        }
        if extracted.Content != "" {
            result = append(result, extracted)
        }
    }
    return result
}

type ExtractedBlock struct {
    ID      string
    Type    string
    Content string
}
```

---

## 5. MCP Tools API

### 5.1 新增 Tools 定义

在 `cmd/mcp-server/tools.go` 中添加：

```go
// semantic_search - 语义搜索
{
    Name:        "semantic_search",
    Description: "Search documents by semantic similarity using natural language. Returns relevant text blocks with context and similarity scores.",
    InputSchema: InputSchema{
        Type: "object",
        Properties: map[string]Property{
            "query": {Type: "string", Description: "Natural language search query"},
            "limit": {Type: "number", Description: "Maximum results to return (default: 5, max: 20)"},
        },
        Required: []string{"query"},
    },
}

// reindex_documents - 重建索引
{
    Name:        "reindex_documents",
    Description: "Rebuild the semantic search index for all documents. Run this after adding new documents or if search results seem stale.",
    InputSchema: InputSchema{Type: "object"},
}

// get_rag_config - 获取配置
{
    Name:        "get_rag_config",
    Description: "Get current RAG/embedding configuration including provider, model, and API settings.",
    InputSchema: InputSchema{Type: "object"},
}

// set_rag_config - 更新配置
{
    Name:        "set_rag_config",
    Description: "Update RAG configuration. Supports Ollama (local) and OpenAI-compatible APIs.",
    InputSchema: InputSchema{
        Type: "object",
        Properties: map[string]Property{
            "provider": {Type: "string", Description: "Provider: 'ollama' or 'openai'"},
            "baseUrl":  {Type: "string", Description: "API base URL (e.g., http://localhost:11434 for Ollama)"},
            "model":    {Type: "string", Description: "Embedding model name"},
            "apiKey":   {Type: "string", Description: "API key (required for OpenAI)"},
        },
    },
}
```

### 5.2 Tool Handlers 实现

新建 `cmd/mcp-server/tool_rag.go`：

```go
package main

import (
    "encoding/json"
    "nook/internal/rag"
)

func (s *MCPServer) toolSemanticSearch(args json.RawMessage) ToolCallResult {
    var params struct {
        Query string `json:"query"`
        Limit int    `json:"limit"`
    }
    json.Unmarshal(args, &params)

    if params.Limit <= 0 {
        params.Limit = 5
    }
    if params.Limit > 20 {
        params.Limit = 20
    }

    results, err := s.ragSearcher.Search(params.Query, params.Limit)
    if err != nil {
        return errorResult("Semantic search failed: " + err.Error())
    }

    data, _ := json.MarshalIndent(results, "", "  ")
    return textResult(string(data))
}

func (s *MCPServer) toolReindexDocuments(args json.RawMessage) ToolCallResult {
    count, err := s.ragIndexer.ReindexAll()
    if err != nil {
        return errorResult("Reindex failed: " + err.Error())
    }
    return textResult(fmt.Sprintf("Successfully indexed %d documents", count))
}

func (s *MCPServer) toolGetRagConfig(args json.RawMessage) ToolCallResult {
    config, _ := rag.LoadConfig(s.dataDir)
    // 隐藏 API Key
    safeConfig := *config
    if safeConfig.APIKey != "" {
        safeConfig.APIKey = "***"
    }
    data, _ := json.MarshalIndent(safeConfig, "", "  ")
    return textResult(string(data))
}

func (s *MCPServer) toolSetRagConfig(args json.RawMessage) ToolCallResult {
    var params rag.EmbeddingConfig
    json.Unmarshal(args, &params)

    // 合并现有配置
    existing, _ := rag.LoadConfig(s.dataDir)
    if params.Provider != "" {
        existing.Provider = params.Provider
    }
    if params.BaseURL != "" {
        existing.BaseURL = params.BaseURL
    }
    if params.Model != "" {
        existing.Model = params.Model
    }
    if params.APIKey != "" {
        existing.APIKey = params.APIKey
    }

    if err := rag.SaveConfig(s.dataDir, existing); err != nil {
        return errorResult("Failed to save config: " + err.Error())
    }
    return textResult("RAG configuration updated successfully")
}
```

### 5.3 响应示例

**semantic_search 响应：**

```json
[
  {
    "docId": "abc-123",
    "docTitle": "项目计划",
    "blockId": "block-456",
    "content": "本季度目标是完成用户认证模块的重构",
    "blockType": "paragraph",
    "score": 0.89
  },
  {
    "docId": "def-789",
    "docTitle": "技术笔记",
    "blockId": "block-012",
    "content": "认证系统采用 JWT + Refresh Token 方案",
    "blockType": "paragraph",
    "score": 0.76
  }
]
```

---

## 6. 实现步骤

### Phase 1: 基础设施

**Step 1.1: 添加依赖**
```bash
go get github.com/asg017/sqlite-vec-go-bindings/cgo
```

**Step 1.2: 创建 internal/rag 包**
```
internal/rag/
├── config.go      # 配置管理
├── embedding.go   # Embedding 客户端
├── store.go       # 向量存储
├── indexer.go     # 索引器
├── searcher.go    # 搜索器
├── extract.go     # BlockNote 内容提取
└── rag.go         # 统一入口
```

### Phase 2: 核心功能

**Step 2.1: 实现 Embedding 客户端**
- Ollama 客户端（`/api/embeddings` 端点）
- OpenAI 兼容客户端（`/embeddings` 端点）
- 统一接口 `EmbeddingClient`

**Step 2.2: 实现向量存储**
- 初始化 sqlite-vec
- CRUD 操作
- 向量搜索查询

**Step 2.3: 实现索引器**
- BlockNote 内容提取
- 单文档索引
- 全量重建索引

### Phase 3: MCP 集成

**Step 3.1: 扩展 MCP Server**
- 在 `MCPServer` 结构体添加 RAG 组件
- 注册新 Tools

**Step 3.2: 实现 Tool Handlers**
- `toolSemanticSearch`
- `toolReindexDocuments`
- `toolGetRagConfig`
- `toolSetRagConfig`

**Step 3.3: 测试验证**
- 启动 Ollama 并拉取模型
- 通过 Claude Code 调用测试

---

## 7. 测试命令

```bash
# 1. 安装 Ollama 并拉取 embedding 模型
ollama pull nomic-embed-text

# 2. 构建 MCP Server
go build -o nook-mcp ./cmd/mcp-server

# 3. 通过 Claude Code 测试
# 在 Claude Code 中配置 MCP Server 后，可以使用：
# - semantic_search: 语义搜索文档
# - reindex_documents: 重建索引
# - get_rag_config / set_rag_config: 管理配置
```

---

## 8. 注意事项

### 8.1 性能考虑

- **首次索引**：大量文档时可能耗时较长，考虑添加进度反馈
- **Embedding 调用**：Ollama 本地调用较慢，批量处理时注意超时设置
- **向量维度**：不同模型维度不同，切换模型需重建索引

### 8.2 错误处理

- Ollama 未启动时返回友好错误提示
- API Key 无效时明确告知用户
- 索引失败的文档跳过但记录日志

### 8.3 后续扩展方向

1. **增量索引**：监听文档保存事件自动更新索引
2. **混合搜索**：结合关键词搜索和语义搜索
3. **上下文扩展**：返回匹配块的前后文
4. **应用内 UI**：在 Nook 中添加语义搜索入口
