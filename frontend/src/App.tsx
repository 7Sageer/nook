import { useState, useEffect, useCallback } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { WindowToolbar } from "./components/WindowToolbar";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { DocumentProvider, useDocumentContext } from "./contexts/DocumentContext";
import { useImport } from "./hooks/useImport";
import { useExport } from "./hooks/useExport";
import { ExternalFileProvider, useExternalFileContext } from "./contexts/ExternalFileContext";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useEditor } from "./hooks/useEditor";
import { useTitleSync } from "./hooks/useTitleSync";
import { useH1Visibility } from "./hooks/useH1Visibility";
import { useAppEvents } from "./hooks/useAppEvents";
import { useExternalLinks } from "./hooks/useExternalLinks";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { Block } from "@blocknote/core";
import { STRINGS } from "./constants/strings";
import "./App.css";
import "./styles/print.css";

function AppContent() {
  const { theme, themeSetting, toggleTheme } = useTheme();

  // 从 Context 获取文档和文件夹状态
  const {
    documents,
    activeId,
    isLoading,
    folders,
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    loadContent,
    saveContent,
    createFolder,
    refreshDocuments,
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
      console.log('[App] Index changed, refreshing documents...');
      refreshDocuments();
    },
    onDocumentChange: async (event) => {
      console.log('[App] Document changed:', event.docId);
      // 如果当前活动文档被修改，重新加载内容
      if (event.docId === activeId && !isExternalMode) {
        const blocks = await loadContent(event.docId);
        if (blocks) {
          setContent(blocks);
          setEditorKey(`doc-${event.docId}-${Date.now()}`);
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
    onNewFolder: createFolder,
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
        onCreateFolder={() => createFolder()}
        themeSetting={themeSetting}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
      <div className={`sidebar-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          externalFiles={externalFiles}
          activeExternalPath={activeExternalPath}
          onSelectExternal={handleSwitchToExternal}
          onCloseExternal={closeExternal}
          collapsed={sidebarCollapsed}
          onSelectInternal={handleSwitchToInternal}
        />
      </div>
      <div className="main-content">
        <Header
          title={currentTitle}
          status={status}
          showTitle={!isH1Visible && !editorAnimating && !contentLoading}
        />
        <main className="editor-container">
          {isLoading || contentLoading ? (
            <div className="loading">{STRINGS.STATUS.LOADING}</div>
          ) : editorKey ? (
            <div className={editorAnimating ? "editor-fade-exit" : "editor-fade-enter"}>
              <Editor
                key={editorKey}
                initialContent={content}
                onChange={handleChange}
                editorRef={editorRef}
              />
            </div>
          ) : (
            <div className="empty-state">
              <p>{STRINGS.LABELS.EMPTY_APP}</p>
              <button onClick={() => createDoc()}>{STRINGS.BUTTONS.CREATE_DOC}</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <DocumentProvider>
        <ExternalFileProvider>
          <AppContent />
        </ExternalFileProvider>
      </DocumentProvider>
    </ThemeProvider>
  );
}

export default App;
