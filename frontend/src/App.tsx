import { useState, useEffect, useCallback } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { WindowToolbar } from "./components/WindowToolbar";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useDocuments } from "./hooks/useDocuments";
import { useFolders } from "./hooks/useFolders";
import { useImportExport } from "./hooks/useImportExport";
import { useExternalFile } from "./hooks/useExternalFile";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useEditor } from "./hooks/useEditor";
import { useTitleSync } from "./hooks/useTitleSync";
import { EventsEmit, EventsOn } from "../wailsjs/runtime/runtime";
import { Block } from "@blocknote/core";
import { STRINGS } from "./constants/strings";
import "./App.css";

function AppContent() {
  const { theme, themeSetting, toggleTheme } = useTheme();
  const {
    documents,
    activeId,
    isLoading,
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    loadContent,
    saveContent,
    refresh: refreshDocuments,
  } = useDocuments();

  const {
    folders,
    createFolder,
    deleteFolder,
    renameFolder,
    toggleCollapsed,
    moveDocument,
  } = useFolders();

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
  } = useExternalFile();

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

  // 文档切换时重置标题同步状态
  useEffect(() => {
    resetTitleSync();
  }, [activeId, resetTitleSync]);

  const { handleImport, handleExport } = useImportExport({
    editorRef,
    activeId,
    documents,
    createDoc,
    saveContent,
    onContentChange: setContent,
  });

  // 菜单事件处理
  const handleCreateInternalDocument = useCallback(() => {
    deactivateExternal();
    createDoc();
  }, [createDoc, deactivateExternal]);

  const handleNewDocument = useCallback(() => {
    handleCreateInternalDocument();
  }, [handleCreateInternalDocument]);

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
    onNewDocument: handleNewDocument,
    onNewFolder: createFolder,
    onImport: handleImport,
    onExport: handleExport,
    onToggleSidebar: handleToggleSidebar,
    onToggleTheme: toggleTheme,
    onAbout: handleAbout,
    onOpenExternal: handleOpenExternal,
  });

  // 监听系统文件打开事件（macOS Finder 双击打开）
  useEffect(() => {
    const unsubscribe = EventsOn('file:open-external', async (filePath: string) => {
      setContentLoading(true);
      try {
        // 通过后端读取文件内容
        const { LoadExternalFile } = await import('../wailsjs/go/main/App');
        const fileContent = await LoadExternalFile(filePath);

        openExternalByPath(filePath, fileContent);

        // 无论编辑器是否已初始化，都解析并展示
        const blocks = await parseMarkdownToBlocks(fileContent);
        setContent(blocks);
        setEditorKey(`external-${filePath}`);
      } catch (e) {
        console.error('打开文件失败:', e);
      } finally {
        setContentLoading(false);
      }
    });

    // 通知后端：前端已注册文件打开事件监听器，可安全 flush 启动时的待处理打开请求
    EventsEmit('app:frontend-ready');

    return () => unsubscribe();
  }, [openExternalByPath, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

  // 保存文档
  const handleChange = async (blocks: Block[]) => {
    if (isExternalMode && activeExternalFile && editorRef.current) {
      // 保存外部文件
      try {
        const markdown = await editorRef.current.blocksToMarkdownLossy();
        await saveExternal(markdown);
        setStatus(STRINGS.STATUS.SAVED);
        setTimeout(() => setStatus(""), 1000);
      } catch (e) {
        console.error('保存外部文件失败:', e);
      }
    } else if (activeId) {
      // 保存内容
      saveContent(activeId, blocks).then(() => {
        setStatus(STRINGS.STATUS.SAVED);
        setTimeout(() => setStatus(""), 1000);
      });

      // 自动同步 H1 标题
      syncTitleFromBlocks(blocks);
    }
  };

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

  const activeDoc = documents.find((d) => d.id === activeId);

  // 当前显示的标题
  const currentTitle = isExternalMode
    ? activeExternalFile?.name || STRINGS.LABELS.EXTERNAL_FILE
    : activeDoc?.title || "";

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
          documents={documents}
          folders={folders}
          activeId={isExternalMode ? null : activeId}
          onSelect={handleSwitchToInternal}
          onSelectExternal={handleSwitchToExternal}
          onCreate={handleCreateInternalDocument}
          onCreateFolder={() => createFolder()}
          onDelete={deleteDoc}
          onRename={renameDoc}
          onDeleteFolder={async (id) => {
            await deleteFolder(id);
            refreshDocuments();
          }}
          onRenameFolder={renameFolder}
          onToggleFolder={toggleCollapsed}
          onMoveToFolder={async (docId, folderId) => {
            await moveDocument(docId, folderId);
            refreshDocuments();
          }}
          externalFiles={externalFiles}
          activeExternalPath={activeExternalPath}
          onCloseExternal={closeExternal}
          collapsed={sidebarCollapsed}
        />
      </div>
      <div className="main-content">
        <Header
          title={currentTitle}
          status={status}
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
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
