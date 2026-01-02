import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { EditorContainer } from "./components/EditorContainer";
import { SidebarContainer } from "./components/SidebarContainer";
import { WindowToolbar } from "./components/WindowToolbar";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { DocumentProvider, useDocumentContext } from "./contexts/DocumentContext";
import { useImport } from "./hooks/useImport";
import { useExport } from "./hooks/useExport";
import { ExternalFileProvider, useExternalFileContext } from "./contexts/ExternalFileContext";
import { SearchProvider, useSearchContext } from "./contexts/SearchContext";
import { RelatedDocumentsProvider, useRelatedDocuments } from "./contexts/RelatedDocumentsContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SettingsModal } from "./components/SettingsModal";
import { ToastProvider } from "./components/Toast";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useEditor } from "./hooks/useEditor";
import { useTitleSync } from "./hooks/useTitleSync";
import { useH1Visibility } from "./hooks/useH1Visibility";
import { useAppEvents } from "./hooks/useAppEvents";
import { useExternalLinks } from "./hooks/useExternalLinks";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useKeyboardNavigation, useFocusZone } from "./hooks/useKeyboardNavigation";
import { useExternalFileHandler } from "./hooks/useExternalFileHandler";

import { getStrings } from "./constants/strings";
import "./App.css";
import "./styles/print.css";

function AppContent() {
  const { theme, language } = useSettings();
  const STRINGS = useMemo(() => getStrings(language), [language]);

  const {
    documents,
    activeId,
    isLoading,

    createDoc,

    renameDoc,
    switchDoc,
    loadContent,
    saveContent,
    pinTag,
    refreshDocuments,
    addTag,
    removeTag,
    setSelectedTag,
  } = useDocumentContext();

  const [status, setStatus] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 外部文件管理
  const {
    externalFiles,
    activeExternalFile,
    activeExternalPath,
    openExternal,
    openExternalByPath,
    saveExternal,
    activateExternal,
    deactivateExternal,
    closeExternal,
    isExternalMode,
  } = useExternalFileContext();

  // 编辑器状态管理
  const {
    content,
    setContent,
    contentLoading,
    setContentLoading,
    editorAnimating,
    editorKey,
    setEditorKey,
    editorRef,
    parseMarkdownToBlocks,
    isDirty,
    markDirty,
    clearDirty,
    setTargetBlockId,
  } = useEditor({
    isExternalMode,
    activeId,
    loadContent,
  });

  // H1 标题自动同步
  const { syncTitleFromBlocks, resetTitleSync } = useTitleSync({
    activeId,
    documents,
    renameDoc,
  });

  // H1 可见性检测（用于智能显示顶栏标题）
  const { isH1Visible } = useH1Visibility(editorKey, activeId);

  // 拦截外部链接点击，在系统浏览器中打开
  useExternalLinks();

  // 监听文件系统变化（外部 Agent 修改时）
  useFileWatcher({
    onIndexChange: () => {
      refreshDocuments();
    },
    onDocumentChange: async (event) => {
      // 如果当前活动文档被修改，检查是否有未保存更改
      if (event.docId === activeId && !isExternalMode) {
        // 如果用户有未保存更改，不自动重载（避免数据丢失）
        if (isDirty) {
          console.warn('[App] 外部修改被忽略：用户有未保存更改');
          return;
        }
        // 锁定编辑器，防止用户在加载期间编辑
        setContentLoading(true);
        try {
          const blocks = await loadContent(event.docId);
          if (blocks) {
            setContent(blocks);
            setEditorKey(`doc-${event.docId}-${Date.now()}`);
          }
        } finally {
          setContentLoading(false);
        }
      }
    },
  });

  // 文档切换时重置标题同步状态
  useEffect(() => {
    resetTitleSync();
  }, [activeId, resetTitleSync]);

  // 搜索上下文 - 用于 Cmd+K 选中文本填充
  const { setQueryWithFocus } = useSearchContext();

  // 相关文档上下文
  const { relatedView, exitRelatedView } = useRelatedDocuments();

  // 区域 refs（用于焦点管理）
  const sidebarRef = useRef<HTMLElement>(null);
  const editorContainerRef = useRef<HTMLElement>(null);

  // === 回调函数定义（必须在 hooks 之前定义） ===

  // 菜单事件处理
  const handleCreateInternalDocument = useCallback(() => {
    deactivateExternal();
    createDoc();
  }, [createDoc, deactivateExternal]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleAbout = useCallback(() => {
    alert(STRINGS.ABOUT_INFO);
  }, [STRINGS.ABOUT_INFO]);

  const handleSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // 搜索快捷键回调
  const handleSearch = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      const selectedText = editor.getSelectedText?.() || '';
      setQueryWithFocus(selectedText.trim());
    } else {
      setQueryWithFocus('');
    }
  }, [editorRef, setQueryWithFocus]);

  // === Hooks 调用 ===

  // 全局快捷键（Cmd+K, Cmd+N, Cmd+\, Cmd+,）
  useKeyboardNavigation({
    onSearch: handleSearch,
    onNewDocument: handleCreateInternalDocument,
    onToggleSidebar: handleToggleSidebar,
    onSettings: handleSettings,
    enabled: !settingsOpen, // 设置模态框打开时禁用
  });

  // 焦点区域管理（F6 切换, Escape 返回编辑器）
  useFocusZone({
    sidebarRef,
    editorRef: editorContainerRef,
    enabled: !settingsOpen,
  });

  const { handleImport } = useImport({
    editorRef,
    createDoc,
    saveContent,
    onContentChange: setContent,
  });

  // 当前文档标题（需要在 useExport 之前计算）
  const activeDoc = documents.find((d) => d.id === activeId);
  const currentTitle = isExternalMode
    ? activeExternalFile?.name || STRINGS.LABELS.EXTERNAL_FILE
    : activeDoc?.title || "";

  // 统一导出功能
  const { handleExportMarkdown, handleExportHTML, handleCopyImage, handleSaveImage, handlePrint } = useExport({
    editorRef,
    documentTitle: currentTitle,
    documents,
    activeId,
    onSuccess: (msg) => setStatus(msg),
    onError: (err) => console.error('Export failed:', err),
  });

  // 外部文件操作
  const { handleOpenExternal, handleSwitchToExternal } = useExternalFileHandler({
    externalFiles,
    openExternal,
    openExternalByPath,
    activateExternal,
    parseMarkdownToBlocks,
    setContent,
    setContentLoading,
    setEditorKey,
  });

  // 使用 useAppEvents 处理文件打开和保存事件
  const { handleChange } = useAppEvents({
    openExternalByPath,
    saveExternal,
    isExternalMode,
    activeExternalFile,
    editorRef,
    parseMarkdownToBlocks,
    setContent,
    setContentLoading,
    setEditorKey,
    activeId,
    saveContent,
    syncTitleFromBlocks,
    markDirty,
    clearDirty,
    setStatus,
    statusSavedText: STRINGS.STATUS.SAVED,
  });



  // 监听菜单事件
  useMenuEvents({
    onNewDocument: handleCreateInternalDocument,
    onNewFolder: () => pinTag(STRINGS.DEFAULTS.NEW_PINNED_TAG),
    onImport: handleImport,
    onExport: handleExportMarkdown,
    onCopyImage: handleCopyImage,
    onSaveImage: handleSaveImage,
    onExportHTML: handleExportHTML,
    onPrint: handlePrint,
    onToggleSidebar: handleToggleSidebar,
    onAbout: handleAbout,
    onOpenExternal: handleOpenExternal,
    onSettings: handleSettings,
  });

  // 切换回内部文档
  const handleSwitchToInternal = useCallback((id: string, blockId?: string) => {
    deactivateExternal();
    switchDoc(id);
    // 如果指定了 blockId，设置目标块以便滚动
    if (blockId) {
      setTargetBlockId(blockId);
    }
  }, [deactivateExternal, switchDoc, setTargetBlockId]);



  return (
    <div className={`app-container ${theme}`}>
      <WindowToolbar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onCreateDocument={handleCreateInternalDocument}
        onCreateFolder={() => pinTag(STRINGS.DEFAULTS.NEW_PINNED_TAG)}
        onSettings={handleSettings}
        theme={theme}
      />
      <SidebarContainer
        externalFiles={externalFiles}
        activeExternalPath={activeExternalPath}
        collapsed={sidebarCollapsed}
        onSelectInternal={handleSwitchToInternal}
        onSelectExternal={handleSwitchToExternal}
        onCloseExternal={closeExternal}
        relatedView={relatedView}
        onExitRelatedView={exitRelatedView}
      />
      <EditorContainer
        content={content}
        editorKey={editorKey}
        editorRef={editorRef}
        editorAnimating={editorAnimating}
        contentLoading={contentLoading}
        isLoading={isLoading}
        documents={documents}
        activeId={activeId}
        activeDoc={activeDoc}
        isExternalMode={isExternalMode}
        activeExternalFile={activeExternalFile}
        isH1Visible={isH1Visible}
        status={status}
        onChange={handleChange}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onTagClick={setSelectedTag}
        onCreateDoc={createDoc}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <DocumentProvider>
          <ExternalFileProvider>
            <SearchProvider>
              <RelatedDocumentsProvider>
                <ToastProvider>
                  <AppContent />
                </ToastProvider>
              </RelatedDocumentsProvider>
            </SearchProvider>
          </ExternalFileProvider>
        </DocumentProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
