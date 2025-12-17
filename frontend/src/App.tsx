import { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useDocuments } from "./hooks/useDocuments";
import { useImportExport } from "./hooks/useImportExport";
import { useMenuEvents } from "./hooks/useMenuEvents";
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

  // 监听菜单事件
  useMenuEvents({
    onNewDocument: handleNewDocument,
    onImport: handleImport,
    onExport: handleExport,
    onToggleSidebar: handleToggleSidebar,
    onToggleTheme: toggleTheme,
    onAbout: handleAbout,
  });

  // 加载当前文档内容（带动画）
  useEffect(() => {
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
  }, [activeId]);

  // 保存文档
  const handleChange = (blocks: Block[]) => {
    if (activeId) {
      saveContent(activeId, blocks).then(() => {
        setStatus("已保存");
        setTimeout(() => setStatus(""), 1000);
      });
    }
  };

  const activeDoc = documents.find((d) => d.id === activeId);

  return (
    <div className={`app-container ${theme}`}>
      <Sidebar
        documents={documents}
        activeId={activeId}
        onSelect={switchDoc}
        onCreate={() => createDoc()}
        onDelete={deleteDoc}
        onRename={renameDoc}
        onImport={handleImport}
        onExport={handleExport}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <div className="main-content">
        <Header title={activeDoc?.title || ""} status={status} />
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
