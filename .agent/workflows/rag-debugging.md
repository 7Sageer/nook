---
description: RAG 索引与搜索常见问题排查
---

# RAG 索引与搜索调试指南

## 常见问题模式

### 1. 索引成功但数据库无记录
**症状**: 日志显示 chunks 创建成功，但 `vectors.db` 中没有对应记录

**排查步骤**:
1. 检查 `Upsert` 调用是否有错误处理（Go 中忽略返回值很常见）
2. 检查是否有后续操作删除了刚存储的数据（如文档自动保存触发重新索引）

**典型 Bug**:
```go
// ❌ 错误：忽略返回错误
s.store.Upsert(&BlockVector{...})

// ✅ 正确：检查并记录错误
if err := s.store.Upsert(&BlockVector{...}); err != nil {
    fmt.Printf("❌ Failed to upsert: %v\n", err)
}
```

### 2. 新增的块类型被意外删除
**症状**: 新类型块（如 `file`）索引后被后续文档索引删除

**原因**: 删除逻辑只保护了已知类型（如 `bookmark`），没有保护新类型

**检查位置**:
- `IndexDocument` 中的删除逻辑
- `ForceReindexDocument` 中的 `DeleteNonBookmarkByDocID`
- 任何 `WHERE block_type != 'xxx'` 的 SQL 查询

**修复模式**:
```go
// ❌ 只保护一种类型
if !strings.Contains(id, "_bookmark") {
    toDelete = append(toDelete, id)
}

// ✅ 保护所有外部索引类型
if !strings.Contains(id, "_bookmark") && !strings.Contains(id, "_file") {
    toDelete = append(toDelete, id)
}
```

### 3. 语义搜索无法定位到块
**症状**: 点击搜索结果后，控制台显示 `Target block not found: xxx`

**原因**:
1. `SourceBlockID` 未设置（存储时遗漏）
2. ID 解析逻辑不支持新格式（如 `_file` 后缀）

**检查位置**:
- 存储时是否设置了 `SourceBlockID`
- `parseSourceBlockId()` 是否支持新的 ID 格式

**ID 格式约定**:
- 普通块: `{blockId}` 或 `{blockId}_chunk_N`
- Bookmark: `{docId}_{blockId}_bookmark` 或 `..._chunk_N`
- File: `{docId}_{blockId}_file` 或 `..._chunk_N`
- 聚合块: `agg_xxx`（无法定位）

### 4. 统计数量不正确
**症状**: Settings 中显示的索引数量与实际不符

**检查位置**:
- `GetIndexedStats()` 的 SQL 查询条件
- 新增类型是否被正确统计或排除

## 调试命令

```bash
# 启用 RAG 分块调试日志
DEBUG_RAG_CHUNKS=1 wails dev

# 查看数据库中各类型块数量
sqlite3 ~/.Nook/vectors.db "SELECT block_type, COUNT(*) FROM block_vectors GROUP BY block_type"

# 查看特定类型的记录
sqlite3 ~/.Nook/vectors.db "SELECT id, substr(content, 1, 50) FROM block_vectors WHERE block_type = 'file'"

# 查看向量表记录数（需要应用内查询，sqlite3 CLI 无法访问 vec0 扩展）
```

## 添加新索引类型的 Checklist

当添加类似 `file` 的新索引类型时：

- [ ] 存储时设置 `SourceBlockID`（用于搜索结果定位）
- [ ] 在 `IndexDocument` 删除逻辑中保护新类型
- [ ] 在 `DeleteNonBookmarkByDocID` 中排除新类型
- [ ] 在 `GetIndexedStats` 中正确统计/排除新类型
- [ ] 在 `parseSourceBlockId` 中添加新格式解析
- [ ] 添加前端显示（如 Settings Modal 统计）
- [ ] 添加错误日志便于调试
