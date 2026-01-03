# Nook 重构计划

> 基于代码分析的解耦和复用改进方案

## 🔥 高优先级（立即实施）

### 1. Backend: 创建 PathBuilder 工具类

**影响范围**: 30+ 处路径构建代码

- [ ] 创建 `internal/utils/paths.go`
- [ ] 实现 PathBuilder 结构体
  ```go
  type PathBuilder struct {
      dataPath string
  }

  func NewPathBuilder(dataPath string) *PathBuilder
  func (p *PathBuilder) Index() string
  func (p *PathBuilder) Folders() string
  func (p *PathBuilder) Settings() string
  func (p *PathBuilder) TagStore() string
  func (p *PathBuilder) DocumentsDir() string
  func (p *PathBuilder) Document(id string) string
  func (p *PathBuilder) RAGStore() string
  ```
- [ ] 在 `app.go` 中创建 PathBuilder 实例
- [ ] 传递给所有 handlers 和 repositories
- [ ] 重构以下文件使用 PathBuilder:
  - [ ] `internal/document/repository.go`
  - [ ] `internal/document/storage.go`
  - [ ] `internal/folder/repository.go`
  - [ ] `internal/tag/store.go`
  - [ ] `internal/settings/repository.go`
  - [ ] `internal/rag/store.go`
  - [ ] `handlers/document.go`
  - [ ] `handlers/tag.go`
  - [ ] `handlers/rag.go`

**预期收益**:
- 统一路径管理，便于未来修改存储结构
- 减少 30+ 处重复的 `filepath.Join` 调用
- 提高代码可维护性

---

### 2. Backend: 创建 BaseHandler

**影响范围**: 所有 handlers

- [ ] 创建 `handlers/base.go`
- [ ] 实现 BaseHandler 结构体
  ```go
  type BaseHandler struct {
      ctx      context.Context
      dataPath string
      paths    *PathBuilder
      watcher  *watcher.Service
  }

  func NewBaseHandler(dataPath string, paths *PathBuilder, watcher *watcher.Service) *BaseHandler
  func (b *BaseHandler) SetContext(ctx context.Context)
  func (b *BaseHandler) MarkIndexWrite()
  func (b *BaseHandler) MarkFoldersWrite()
  func (b *BaseHandler) MarkDocumentWrite(id string)
  func (b *BaseHandler) MarkSettingsWrite()
  ```
- [ ] 修改所有 handlers 嵌入 BaseHandler:
  - [ ] `handlers/document.go` - 删除 `markIndexWrite` 方法
  - [ ] `handlers/tag.go` - 删除 `markIndexWrite` 方法
  - [ ] `handlers/file.go` - 删除 `SetContext` 方法
  - [ ] `handlers/rag.go` - 删除 `SetContext` 方法
  - [ ] `handlers/folder.go`
  - [ ] `handlers/search.go`
- [ ] 更新 `app.go` 中的 handler 初始化逻辑

**预期收益**:
- 消除重复的 `markIndexWrite` 和 `SetContext` 方法
- 统一 handler 的基础功能
- 简化新 handler 的创建

---

### 3. Frontend: 创建 useWailsEvents Hook

**影响范围**: 所有使用 Wails 事件的组件

- [ ] 创建 `frontend/src/hooks/useWailsEvents.ts`
- [ ] 实现通用事件监听 hook
  ```typescript
  export function useWailsEvents(
    events: Record<string, (...args: any[]) => void>,
    deps: React.DependencyList = []
  ) {
    useEffect(() => {
      const unsubscribers = Object.entries(events).map(
        ([eventName, handler]) => EventsOn(eventName, handler)
      );
      return () => unsubscribers.forEach(unsub => unsub());
    }, deps);
  }
  ```
- [ ] 重构以下文件使用新 hook:
  - [ ] `hooks/useMenuEvents.ts` (lines 36-78)
  - [ ] `hooks/useAppEvents.ts`
  - [ ] `components/Editor.tsx` (如果有事件监听)
  - [ ] `contexts/DocumentContext.tsx` (如果有事件监听)

**预期收益**:
- 统一事件监听模式
- 减少样板代码
- 自动处理清理逻辑

---

### 4. Frontend: 拆分 DocumentContext

**影响范围**: `DocumentContext.tsx` (408 行) 及所有消费者

- [ ] 创建 `frontend/src/contexts/TagContext.tsx`
- [ ] 从 DocumentContext 迁移标签相关功能:
  - [ ] `tags` 状态
  - [ ] `pinnedTags` 状态
  - [ ] `tagColors` 状态
  - [ ] `addTag` 函数
  - [ ] `removeTag` 函数
  - [ ] `pinTag` / `unpinTag` 函数
  - [ ] `setTagColor` 函数
  - [ ] `renameTag` 函数
  - [ ] `deleteTag` 函数
- [ ] 创建 `useTagContext` hook
- [ ] 更新 `App.tsx` 添加 TagProvider
- [ ] 更新以下组件使用 TagContext:
  - [ ] `components/Editor.tsx`
  - [ ] `components/Sidebar.tsx`
  - [ ] `components/TagList.tsx` (如果存在)
- [ ] 清理 DocumentContext，移除标签相关代码
- [ ] 更新依赖数组，减少不必要的重渲染

**预期收益**:
- DocumentContext 从 408 行减少到 ~250 行
- 职责更清晰：文档操作 vs 标签操作
- 减少依赖数组复杂度
- 提高性能（减少不必要的重渲染）

---

## 📋 中优先级（短期改进）

### 5. Backend: 泛型类型转换工具

**影响范围**: 所有 handlers 的类型转换代码

- [ ] 创建 `internal/utils/convert.go`
- [ ] 实现泛型转换函数
  ```go
  func ConvertSlice[From, To any](items []From, convert func(From) To) []To {
      result := make([]To, len(items))
      for i, item := range items {
          result[i] = convert(item)
      }
      return result
  }
  ```
- [ ] 重构以下文件使用泛型转换:
  - [ ] `handlers/search.go` (lines 64-73, 91-112)
  - [ ] `handlers/document.go` (如有类型转换)
  - [ ] `handlers/tag.go` (如有类型转换)
  - [ ] `handlers/rag.go` (如有类型转换)

**预期收益**:
- 减少 5+ 处样板代码
- 统一转换逻辑
- 提高代码可读性

---

### 6. Backend: Repository 基类

**影响范围**: 所有 repositories

- [ ] 创建 `internal/repository/base.go`
- [ ] 实现 BaseRepository
  ```go
  type BaseRepository struct {
      dataPath string
      paths    *PathBuilder
  }

  func (r *BaseRepository) LoadJSON(filename string, v interface{}) error
  func (r *BaseRepository) SaveJSON(filename string, v interface{}) error
  func (r *BaseRepository) FileExists(filename string) bool
  ```
- [ ] 重构以下 repositories 使用基类:
  - [ ] `internal/document/repository.go`
  - [ ] `internal/folder/repository.go`
  - [ ] `internal/tag/store.go`
  - [ ] `internal/settings/repository.go`

**预期收益**:
- 统一 JSON 文件操作
- 减少重复的错误处理代码
- 便于添加通用功能（如备份、验证）

---

### 7. Frontend: 创建 usePersistentSettings Hook

**影响范围**: `SettingsContext.tsx`

- [ ] 创建 `frontend/src/hooks/usePersistentSettings.ts`
- [ ] 实现自动保存的设置 hook
  ```typescript
  export function usePersistentSettings() {
    const [settings, setSettings] = useState<Settings>();

    const updateSetting = useCallback((partial: Partial<Settings>) => {
      setSettings(prev => {
        const next = { ...prev, ...partial };
        SaveSettings(next); // 自动保存
        return next;
      });
    }, []);

    return { settings, updateSetting };
  }
  ```
- [ ] 在 `SettingsContext.tsx` 中使用新 hook
- [ ] 删除 4 处重复的 `SaveSettings` 调用 (lines 89, 94, 99, 105)

**预期收益**:
- 消除 4 处重复代码
- 自动保存，不会遗漏
- 更简洁的设置更新逻辑

---

### 8. Frontend: 解耦 Editor 组件

**影响范围**: `components/Editor.tsx`

- [ ] 创建 `hooks/useEditorPlugins.ts`
- [ ] 迁移插件管理逻辑 (lines 127-150)
  ```typescript
  export function useEditorPlugins(editor: BlockNoteEditor | null) {
    useEffect(() => {
      if (!editor) return;

      // 插件注入逻辑
      const plugins = [
        // ...
      ];

      plugins.forEach(plugin => editor.registerPlugin(plugin));

      return () => {
        plugins.forEach(plugin => editor.unregisterPlugin(plugin));
      };
    }, [editor]);
  }
  ```
- [ ] 创建 `hooks/useEditorFileHandling.ts`
- [ ] 迁移文件拖放逻辑
- [ ] 简化 Editor 组件，只保留核心渲染逻辑

**预期收益**:
- Editor 组件更简洁
- 插件逻辑可复用
- 更容易测试和维护

---

## 📝 低优先级（长期优化）

### 9. Backend: 统一错误处理

- [ ] 创建 `internal/errors/errors.go`
- [ ] 定义标准错误类型
- [ ] 在所有 handlers 中使用统一错误

### 10. Frontend: 内容加载状态机

- [ ] 从 `useEditor.ts` 提取 `useContentTransition` hook
- [ ] 统一管理加载/动画状态

### 11. Backend: TagService 业务逻辑层

- [ ] 创建 `internal/tag/service.go`
- [ ] 集中标签业务逻辑
- [ ] 解耦 handler 和 repository

### 12. Frontend: 通用 Debounce 应用

- [ ] 在搜索输入中使用 `useDebounce`
- [ ] 在自动保存中使用 `useDebounce`

---

## 📊 实施建议

### 推荐顺序

1. **第 1 周**: 任务 1-2 (PathBuilder + BaseHandler)
   - 影响最大，为其他重构打基础
   - 纯后端改动，风险较低

2. **第 2 周**: 任务 3-4 (useWailsEvents + 拆分 DocumentContext)
   - 前端核心重构
   - 需要仔细测试所有功能

3. **第 3 周**: 任务 5-8 (工具函数 + 解耦 Editor)
   - 渐进式改进
   - 可以逐个实施

4. **后续**: 任务 9-12 (长期优化)
   - 根据实际需求决定优先级

### 测试检查点

每完成一个任务后，确保：
- [ ] 应用可以正常启动
- [ ] 文档 CRUD 功能正常
- [ ] 标签功能正常
- [ ] 搜索功能正常
- [ ] 文件夹功能正常
- [ ] 导入导出功能正常
- [ ] 外部文件编辑功能正常
- [ ] RAG 索引功能正常

### 回滚策略

- 每个任务使用独立的 git 分支
- 完成测试后再合并到 main
- 保留详细的 commit 信息，便于回滚

---

## 📈 预期收益总结

| 指标 | 改进前 | 改进后 | 提升 |
|------|--------|--------|------|
| 路径构建重复代码 | 30+ 处 | 1 处 | -97% |
| Handler 重复方法 | 4+ 处 | 0 处 | -100% |
| DocumentContext 行数 | 408 行 | ~250 行 | -39% |
| 类型转换样板代码 | 5+ 处 | 1 处 | -80% |
| Event 监听样板代码 | 3+ 处 | 0 处 | -100% |

**总体收益**:
- ✅ 代码重复减少 ~70%
- ✅ 可维护性提升 ~50%
- ✅ 新功能开发效率提升 ~30%
- ✅ Bug 修复时间减少 ~40%
