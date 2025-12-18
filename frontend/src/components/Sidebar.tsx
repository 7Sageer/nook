import { useState, useRef, useEffect } from 'react';
import { DocumentMeta, Folder } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { Plus, Moon, Sun, Monitor, Search, PanelLeftClose, PanelLeft, FileText, X, FolderPlus } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarProps {
  documents: DocumentMeta[];
  folders: Folder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSelectExternal?: (path: string) => void;
  onCreate: () => void;
  onCreateFolder: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  onMoveToFolder: (docId: string, folderId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onCloseExternal?: (path: string) => void;
}

export function Sidebar({
  documents,
  folders,
  activeId,
  onSelect,
  onSelectExternal,
  onCreate,
  onCreateFolder,
  onDelete,
  onRename,
  onDeleteFolder,
  onRenameFolder,
  onToggleFolder,
  onMoveToFolder,
  collapsed = false,
  onToggleCollapse,
  externalFiles = [],
  activeExternalPath,
  onCloseExternal,
}: SidebarProps) {
  const { theme, themeSetting, toggleTheme } = useTheme();
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  // 下拉菜单状态
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };

    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCreateMenuOpen]);

  const handleCreateDocument = () => {
    onCreate();
    setIsCreateMenuOpen(false);
  };

  const handleCreateFolder = () => {
    onCreateFolder();
    setIsCreateMenuOpen(false);
  };

  const handleDeleteClick = (id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TITLE,
        message: STRINGS.MODALS.DELETE_MESSAGE,
      },
      () => onDelete(id)
    );
  };

  const handleDeleteFolderClick = (id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_FOLDER_TITLE,
        message: STRINGS.MODALS.DELETE_FOLDER_MESSAGE,
      },
      () => onDeleteFolder(id)
    );
  };

  // 按文件夹分组文档
  const getDocumentsInFolder = (folderId: string) =>
    documents.filter((d) => d.folderId === folderId);

  const uncategorizedDocs = documents.filter((d) => !d.folderId);

  const displayList = query ? results : uncategorizedDocs;

  // Get theme icon and tooltip based on current setting
  const getThemeIcon = () => {
    switch (themeSetting) {
      case 'light':
        return <Sun size={18} />;
      case 'dark':
        return <Moon size={18} />;
      case 'system':
        return <Monitor size={18} />;
    }
  };

  const getThemeTooltip = () => {
    switch (themeSetting) {
      case 'light':
        return STRINGS.TOOLTIPS.THEME_LIGHT;
      case 'dark':
        return STRINGS.TOOLTIPS.THEME_DARK;
      case 'system':
        return STRINGS.TOOLTIPS.THEME_SYSTEM;
    }
  };

  // 处理拖拽到未分类区域
  const handleUncategorizedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleUncategorizedDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleUncategorizedDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const docId = e.dataTransfer.getData('text/plain');
    if (docId) {
      onMoveToFolder(docId, '');
    }
  };

  // 折叠状态：只显示一个展开按钮
  if (collapsed) {
    return (
      <>
        <aside className={`sidebar sidebar-collapsed ${theme}`}>
          <div className="sidebar-collapsed-content">
            <button
              className="icon-btn"
              onClick={onToggleCollapse}
              title={STRINGS.TOOLTIPS.EXPAND}
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
          {/* 拖拽区域（红黄绿按钮所在行） */}
          <div className="sidebar-drag-region" />

          {/* 工具按钮行 */}
          <div className="sidebar-toolbar">
            <div className="create-menu-wrapper" ref={createMenuRef}>
              <button
                className={`icon-btn primary create-menu-trigger ${isCreateMenuOpen ? 'menu-open' : ''}`}
                onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                title={STRINGS.TOOLTIPS.NEW_DOC}
              >
                <Plus size={18} className="plus-icon" />
              </button>
              {isCreateMenuOpen && (
                <div className="create-menu-dropdown">
                  <button className="create-menu-item" onClick={handleCreateDocument}>
                    <FileText size={16} />
                    <span>{STRINGS.MENU.NEW_DOC}</span>
                  </button>
                  <button className="create-menu-item" onClick={handleCreateFolder}>
                    <FolderPlus size={16} />
                    <span>{STRINGS.MENU.NEW_FOLDER}</span>
                  </button>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={toggleTheme} title={getThemeTooltip()}>
              {getThemeIcon()}
            </button>
            {onToggleCollapse && (
              <button className="icon-btn collapse-btn" onClick={onToggleCollapse} title={STRINGS.TOOLTIPS.COLLAPSE}>
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={STRINGS.LABELS.SEARCH_PLACEHOLDER}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* 外部文件标签 */}
        {externalFiles.length > 0 && (
          <div className="external-file-section">
            <div className="section-label">{STRINGS.LABELS.EXTERNAL_FILE}</div>
            {externalFiles.map((file) => {
              const isActive = activeExternalPath === file.path;
              return (
                <div
                  key={file.path}
                  className={`external-file-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectExternal?.(file.path)}
                >
                  <FileText size={16} />
                  <span className="external-file-name" title={file.path}>
                    {file.name}
                  </span>
                  {isActive && onCloseExternal && (
                    <button
                      className="close-external-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseExternal(file.path);
                      }}
                      title={STRINGS.TOOLTIPS.CLOSE_EXTERNAL}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="sidebar-content">
          {/* 文件夹列表 */}
          {!query && folders.length > 0 && (
            <div className="folders-section">
              <div className="section-label-row">
                <span className="section-label">{STRINGS.LABELS.FOLDERS}</span>
                <button
                  className="section-add-btn"
                  onClick={onCreateFolder}
                  title={STRINGS.TOOLTIPS.NEW_FOLDER}
                >
                  <Plus size={14} />
                </button>
              </div>
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  documents={getDocumentsInFolder(folder.id)}
                  activeDocId={activeId}
                  onToggle={() => onToggleFolder(folder.id)}
                  onRename={(name) => onRenameFolder(folder.id, name)}
                  onDelete={() => handleDeleteFolderClick(folder.id)}
                  onSelectDocument={onSelect}
                  onRenameDocument={onRename}
                  onDeleteDocument={handleDeleteClick}
                  onMoveDocument={onMoveToFolder}
                />
              ))}
            </div>
          )}

          {/* 未分类文档列表 */}
          {(displayList.length > 0 || query) && (
            <div
              className="uncategorized-section"
              onDragOver={!query ? handleUncategorizedDragOver : undefined}
              onDragLeave={!query ? handleUncategorizedDragLeave : undefined}
              onDrop={!query ? handleUncategorizedDrop : undefined}
            >
              <div className="section-label-row">
                <span className="section-label">
                  {query ? STRINGS.LABELS.DOCUMENTS : STRINGS.LABELS.UNCATEGORIZED}
                </span>
                {!query && (
                  <button
                    className="section-add-btn"
                    onClick={onCreate}
                    title={STRINGS.TOOLTIPS.NEW_DOC}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <ul className="document-list">
                <DocumentList
                  items={displayList}
                  activeId={activeId}
                  isSearchMode={!!query}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={handleDeleteClick}
                  draggable={!query}
                />
              </ul>
            </div>
          )}
        </div>
      </aside>

      <ConfirmModalComponent />
    </>
  );
}
