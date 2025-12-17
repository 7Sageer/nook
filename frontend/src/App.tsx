import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useDocuments } from "./hooks/useDocuments";
import { useImportExport } from "./hooks/useImportExport";
import { useExternalFile } from "./hooks/useExternalFile";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { Block, BlockNoteEditor } from "@blocknote/core";
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
  const handleNewDocument = useCallback(() => {
    createDoc();
  }, [createDoc]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleAbout = useCallback(() => {
    alert("Nostalgia v1.0.0\n\n一个简洁优雅的本地笔记应用");
  }, []);

  // 打开外部文件
  const handleOpenExternal = useCallback(async () => {
    const file = await openExternal();
    if (file && editorRef.current) {
      try {
        const blocks = await editorRef.current.tryParseMarkdownToBlocks(file.content);
        setContent(blocks);
        setEditorKey(`external-${file.path}`);
      } catch (e) {
        console.error('解析文件失败:', e);
      }
    }
  }, [openExternal]);

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
      try {
        // 通过后端读取文件内容
        const { LoadExternalFile } = await import('../wailsjs/go/main/App');
        const content = await LoadExternalFile(filePath);

        openExternalByPath(filePath, content);

        // 如果编辑器已准备好，解析 Markdown
        if (editorRef.current) {
          const blocks = await editorRef.current.tryParseMarkdownToBlocks(content);
          setContent(blocks);
          setEditorKey(`external-${filePath}`);
        }
      } catch (e) {
        console.error('打开文件失败:', e);
      }
    });

    return () => unsubscribe();
  }, [openExternalByPath]);

  // 加载当前文档内容（带动画）
  useEffect(() => {
    // 如果是外部文件模式，跳过内部文档加载
    if (isExternalMode) return;

    if (activeId) {
      // 如果已有编辑器，先触发淡出动画
      if (editorKey && editorKey !== activeId) {
        setEditorAnimating(true);
        // 等待淡出动画完成后再加载新内容
        const timer = setTimeout(() => {
          setContentLoading(true);
          loadContent(activeId).then((data) => {
            setContent(data);
            setEditorKey(activeId);
            setContentLoading(false);
            setEditorAnimating(false);
          });
        }, 150);
        return () => clearTimeout(timer);
      } else {
        // 首次加载，直接加载
        setContentLoading(true);
        loadContent(activeId).then((data) => {
          setContent(data);
          setEditorKey(activeId);
          setContentLoading(false);
        });
      }
    } else {
      setContent(undefined);
      setEditorKey(null);
    }
  }, [activeId, isExternalMode]);

  // 保存文档
  const handleChange = async (blocks: Block[]) => {
    if (isExternalMode && externalFile && editorRef.current) {
      // 保存外部文件
      try {
        const markdown = await editorRef.current.blocksToMarkdownLossy();
        await saveExternal(markdown);
        setStatus("已保存");
        setTimeout(() => setStatus(""), 1000);
      } catch (e) {
        console.error('保存外部文件失败:', e);
      }
    } else if (activeId) {
      saveContent(activeId, blocks).then(() => {
        setStatus("已保存");
        setTimeout(() => setStatus(""), 1000);
      });
    }
  };

  // 切换回内部文档
  const handleSwitchToInternal = useCallback((id: string) => {
    closeExternal();
    switchDoc(id);
  }, [closeExternal, switchDoc]);

  const activeDoc = documents.find((d) => d.id === activeId);

  // 当前显示的标题
  const currentTitle = isExternalMode
    ? externalFile?.name || "外部文件"
    : activeDoc?.title || "";

  return (
    <div className={`app-container ${theme}`}>
      <Sidebar
        documents={documents}
        activeId={isExternalMode ? null : activeId}
        onSelect={handleSwitchToInternal}
        onCreate={() => createDoc()}
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
            <div className="loading">加载中...</div>
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
              <p>暂无文档</p>
              <button onClick={() => createDoc()}>创建新文档</button>
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
