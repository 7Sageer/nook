import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useDocuments } from "./hooks/useDocuments";
import { useImportExport } from "./hooks/useImportExport";
import { useExternalFile } from "./hooks/useExternalFile";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { EventsEmit, EventsOn } from "../wailsjs/runtime/runtime";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { STRINGS } from "./constants/strings";
import "./App.css";

function AppContent() {
  const { theme, toggleTheme } = useTheme();
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
  } = useDocuments();

  const [content, setContent] = useState<Block[] | undefined>(undefined);
  const [status, setStatus] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editorAnimating, setEditorAnimating] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const editorRef = useRef<BlockNoteEditor | null>(null);

  // 外部文件管理
  const {
    externalFile,
    openExternal,
    openExternalByPath,
    saveExternal,
    activateExternal,
    deactivateExternal,
    closeExternal,
    isExternalMode,
  } = useExternalFile();

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

  const parseMarkdownToBlocks = useCallback((markdownText: string) => {
    const editor = editorRef.current ?? BlockNoteEditor.create();
    return editor.tryParseMarkdownToBlocks(markdownText);
  }, []);

  // 打开外部文件
  const handleOpenExternal = useCallback(async () => {
    const file = await openExternal();
    if (!file) return;

    setContentLoading(true);
    try {
      const blocks = parseMarkdownToBlocks(file.content);
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
  }, [activateExternal, openExternal, parseMarkdownToBlocks]);

  // 监听菜单事件
  useMenuEvents({
    onNewDocument: handleNewDocument,
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
        const content = await LoadExternalFile(filePath);

        openExternalByPath(filePath, content);

        // 无论编辑器是否已初始化，都解析并展示
        const blocks = parseMarkdownToBlocks(content);
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
  }, [openExternalByPath, parseMarkdownToBlocks]);

  // 加载当前文档内容（带动画）
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };

    // 如果是外部文件模式，跳过内部文档加载
    if (isExternalMode) return cleanup;

    if (activeId) {
      const currentId = activeId;
      // 如果已有编辑器，先触发淡出动画
      if (editorKey && editorKey !== currentId) {
        setEditorAnimating(true);
        // 等待淡出动画完成后再加载新内容
        timer = setTimeout(() => {
          if (cancelled) return;
          setContentLoading(true);
          loadContent(currentId).then((data) => {
            if (cancelled) return;
            setContent(data);
            setEditorKey(currentId);
            setContentLoading(false);
            setEditorAnimating(false);
          });
        }, 150);
        return cleanup;
      } else {
        // 首次加载，直接加载
        setContentLoading(true);
        loadContent(currentId).then((data) => {
          if (cancelled) return;
          setContent(data);
          setEditorKey(currentId);
          setContentLoading(false);
        });
      }
    } else {
      setContent(undefined);
      setEditorKey(null);
    }
    return cleanup;
  }, [activeId, isExternalMode]);

  // 保存文档
  const handleChange = async (blocks: Block[]) => {
    if (isExternalMode && externalFile && editorRef.current) {
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
      saveContent(activeId, blocks).then(() => {
        setStatus(STRINGS.STATUS.SAVED);
        setTimeout(() => setStatus(""), 1000);
      });
    }
  };

  // 切换回内部文档
  const handleSwitchToInternal = useCallback((id: string) => {
    deactivateExternal();
    switchDoc(id);
  }, [deactivateExternal, switchDoc]);

  // 重新激活外部文件
  const handleSwitchToExternal = useCallback(async () => {
    if (!externalFile) return;
    setContentLoading(true);
    try {
      const { LoadExternalFile } = await import('../wailsjs/go/main/App');
      const content = await LoadExternalFile(externalFile.path);

      openExternalByPath(externalFile.path, content);
      const blocks = parseMarkdownToBlocks(content);
      setContent(blocks);
      setEditorKey(`external-${externalFile.path}`);
      activateExternal();
    } catch (e) {
      console.error('打开外部文件失败:', e);
    } finally {
      setContentLoading(false);
    }
  }, [activateExternal, externalFile, openExternalByPath, parseMarkdownToBlocks]);

  const activeDoc = documents.find((d) => d.id === activeId);

  // 当前显示的标题
  const currentTitle = isExternalMode
    ? externalFile?.name || STRINGS.LABELS.EXTERNAL_FILE
    : activeDoc?.title || "";

  return (
    <div className={`app-container ${theme}`}>
      <Sidebar
        documents={documents}
        activeId={isExternalMode ? null : activeId}
        onSelect={handleSwitchToInternal}
        onSelectExternal={handleSwitchToExternal}
        onCreate={handleCreateInternalDocument}
        onDelete={deleteDoc}
        onRename={renameDoc}
        onImport={handleImport}
        onExport={handleExport}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        externalFile={externalFile}
        onCloseExternal={closeExternal}
        isExternalMode={isExternalMode}
      />
      <div className="main-content">
        <Header title={currentTitle} status={status} />
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
