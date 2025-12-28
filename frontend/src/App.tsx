import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorContainer } from "./components/EditorContainer";
import { SidebarContainer } from "./components/SidebarContainer";
import { WindowToolbar } from "./components/WindowToolbar";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { DocumentProvider, useDocumentContext } from "./contexts/DocumentContext";
import { useImport } from "./hooks/useImport";
import { useExport } from "./hooks/useExport";
import { ExternalFileProvider, useExternalFileContext } from "./contexts/ExternalFileContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useEditor } from "./hooks/useEditor";
import { useTitleSync } from "./hooks/useTitleSync";
import { useH1Visibility } from "./hooks/useH1Visibility";
import { useAppEvents } from "./hooks/useAppEvents";
import { useExternalLinks } from "./hooks/useExternalLinks";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { Block } from "@blocknote/core";
import { getStrings } from "./constants/strings";
import "./App.css";
import "./styles/print.css";

function AppContent() {
  const { theme, themeSetting, toggleTheme, language } = useSettings();
  const STRINGS = useMemo(() => getStrings(language), [language]);

  const {
    documents,
    activeId,
    isLoading,
    tagGroups,
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    loadContent,
    saveContent,
    createTagGroup,
    refreshDocuments,
    addTag,
    removeTag,
    setSelectedTag,
  } = useDocumentContext();

  const [status, setStatus] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  }, []);

  // 打开外部文件
  const handleOpenExternal = useCallback(async () => {
    const file = await openExternal();
    if (!file) return;

    setContentLoading(true);
    try {
      const blocks = await parseMarkdownToBlocks(file.content);
      setContent(blocks);
      setEditorKey(`external-${file.path}`);
      activateExternal();
    } catch (e) {
      console.error('解析文件失败:', e);
      setEditorKey(`external-${file.path}`);
      activateExternal();
    } finally {
      setContentLoading(false);
    }
  }, [activateExternal, openExternal, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

  // 监听菜单事件
  useMenuEvents({
    onNewDocument: handleCreateInternalDocument,
    onNewFolder: createTagGroup,
    onImport: handleImport,
    onExport: handleExportMarkdown,
    onCopyImage: handleCopyImage,
    onSaveImage: handleSaveImage,
    onExportHTML: handleExportHTML,
    onPrint: handlePrint,
    onToggleSidebar: handleToggleSidebar,
    onToggleTheme: toggleTheme,
    onAbout: handleAbout,
    onOpenExternal: handleOpenExternal,
  });

  // 切换回内部文档
  const handleSwitchToInternal = useCallback((id: string) => {
    deactivateExternal();
    switchDoc(id);
  }, [deactivateExternal, switchDoc]);

  // 重新激活外部文件
  const handleSwitchToExternal = useCallback(async (path: string) => {
    const file = externalFiles.find(f => f.path === path);
    if (!file) return;
    setContentLoading(true);
    try {
      const { LoadExternalFile } = await import('../wailsjs/go/main/App');
      const fileContent = await LoadExternalFile(file.path);

      openExternalByPath(file.path, fileContent);
      const blocks = await parseMarkdownToBlocks(fileContent);
      setContent(blocks);
      setEditorKey(`external-${file.path}`);
      activateExternal(file.path);
    } catch (e) {
      console.error('打开外部文件失败:', e);
    } finally {
      setContentLoading(false);
    }
  }, [activateExternal, externalFiles, openExternalByPath, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

  return (
    <div className={`app-container ${theme}`}>
      <WindowToolbar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onCreateDocument={handleCreateInternalDocument}
        onCreateFolder={() => createTagGroup()}
        themeSetting={themeSetting}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <SidebarContainer
        externalFiles={externalFiles}
        activeExternalPath={activeExternalPath}
        collapsed={sidebarCollapsed}
        onSelectInternal={handleSwitchToInternal}
        onSelectExternal={handleSwitchToExternal}
        onCloseExternal={closeExternal}
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
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <DocumentProvider>
          <ExternalFileProvider>
            <AppContent />
          </ExternalFileProvider>
        </DocumentProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
