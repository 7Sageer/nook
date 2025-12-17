import { DocumentMeta } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { Plus, Upload, Download, Moon, Sun, Search, PanelLeftClose, PanelLeft, FileText, X } from 'lucide-react';

interface SidebarProps {
  documents: DocumentMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onImport: () => void;
  onExport: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  externalFile?: ExternalFileInfo | null;
  onCloseExternal?: () => void;
  isExternalMode?: boolean;
}

export function Sidebar({
  documents,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onImport,
  onExport,
  collapsed = false,
  onToggleCollapse,
  externalFile,
  onCloseExternal,
  isExternalMode = false,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const handleDeleteClick = (id: string) => {
    openModal(
      {
        title: '删除文档',
        message: '确定要删除这个文档吗？此操作无法撤销。',
      },
      () => onDelete(id)
    );
  };

  const displayList = query ? results : documents;

  // 折叠状态：只显示一个展开按钮
  if (collapsed) {
    return (
      <>
        <aside className={`sidebar sidebar-collapsed ${theme}`}>
          <div className="sidebar-collapsed-content">
            <button
              className="icon-btn"
              onClick={onToggleCollapse}
              title="展开侧边栏"
            >
              <PanelLeft size={18} />
            </button>
          </div>
        </aside>
        <ConfirmModalComponent />
      </>
    );
  }

  return (
    <>
      <aside className={`sidebar ${theme}`}>
        <div className="sidebar-header">
          <button className="icon-btn primary" onClick={onCreate} title="新建文档">
            <Plus size={18} />
          </button>
          <button className="icon-btn" onClick={onImport} title="导入 Markdown">
            <Upload size={18} />
          </button>
          <button className="icon-btn" onClick={onExport} title="导出 Markdown">
            <Download size={18} />
          </button>
          <button className="icon-btn" onClick={toggleTheme} title="切换主题">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {onToggleCollapse && (
            <button className="icon-btn collapse-btn" onClick={onToggleCollapse} title="折叠侧边栏">
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="搜索文档..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* 外部文件标签 */}
        {externalFile && (
          <div className="external-file-section">
            <div className="section-label">外部文件</div>
            <div
              className={`external-file-item ${isExternalMode ? 'active' : ''}`}
            >
              <FileText size={16} />
              <span className="external-file-name" title={externalFile.path}>
                {externalFile.name}
              </span>
              {onCloseExternal && (
                <button
                  className="close-external-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseExternal();
                  }}
                  title="关闭外部文件"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 文档列表 */}
        {documents.length > 0 && (
          <div className="section-label">文档</div>
        )}
        <ul className="document-list">
          <DocumentList
            items={displayList}
            activeId={activeId}
            isSearchMode={!!query}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={handleDeleteClick}
          />
        </ul>
      </aside>

      <ConfirmModalComponent />
    </>
  );
}
