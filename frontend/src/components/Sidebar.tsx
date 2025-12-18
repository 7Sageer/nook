import { useMemo, useState, useRef, useCallback } from 'react';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { Search, FileText, X, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarProps {
  // 外部文件相关（仍由 App.tsx 管理）
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onSelectExternal?: (path: string) => void;
  onCloseExternal?: (path: string) => void;
  // UI 状态
  collapsed?: boolean;
  // 切换到内部文档时的回调（用于退出外部文件模式）
  onSelectInternal?: (id: string) => void;
}

export function Sidebar({
  externalFiles = [],
  activeExternalPath,
  onSelectExternal,
  onCloseExternal,
  collapsed = false,
  onSelectInternal,
}: SidebarProps) {
  // 从 Context 获取文档和文件夹状态
  const {
    documents,
    activeId,
    folders,
    createDoc,
    deleteDoc,
    switchDoc,
    reorderDocuments,
    createFolder,
    deleteFolder,
    renameFolder,
    toggleFolderCollapsed,
    moveDocumentToFolder,
    reorderFolders,
  } = useDocumentContext();
  const { theme } = useTheme();
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const draggedFolderIdRef = useRef<string | null>(null);

  // 选择文档时的处理
  const handleSelect = useCallback((id: string) => {
    if (onSelectInternal) {
      onSelectInternal(id);
    } else {
      switchDoc(id);
    }
  }, [onSelectInternal, switchDoc]);

  // 创建文档
  const handleCreate = useCallback(() => {
    createDoc();
  }, [createDoc]);

  // 在文件夹中创建文档
  const handleCreateInFolder = useCallback(async (folderId: string) => {
    await createDoc('无标题', folderId);
  }, [createDoc]);

  // 创建文件夹
  const handleCreateFolder = useCallback(() => {
    createFolder();
  }, [createFolder]);

  const handleDeleteClick = (id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TITLE,
        message: STRINGS.MODALS.DELETE_MESSAGE,
      },
      () => deleteDoc(id)
    );
  };

  const handleDeleteFolderClick = (id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_FOLDER_TITLE,
        message: STRINGS.MODALS.DELETE_FOLDER_MESSAGE,
      },
      () => deleteFolder(id)
    );
  };

  // 按文件夹分组文档
  const getDocumentsInFolder = (folderId: string) =>
    documents.filter((d) => d.folderId === folderId);

  const uncategorizedDocs = documents.filter((d) => !d.folderId);
  const displayList = query ? results : uncategorizedDocs;

  // 排序后的文件夹
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.order - b.order);
  }, [folders]);

  // 文件夹拖拽排序
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    draggedFolderIdRef.current = folderId;
    e.dataTransfer.setData('folder-id', folderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    // 只有拖拽的是文件夹时才处理
    if (draggedFolderIdRef.current && draggedFolderIdRef.current !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);

    const draggedFolderId = draggedFolderIdRef.current;
    draggedFolderIdRef.current = null;

    if (!draggedFolderId || draggedFolderId === targetFolderId) return;

    const currentIds = sortedFolders.map(f => f.id);
    const draggedIndex = currentIds.indexOf(draggedFolderId);
    const targetIndex = currentIds.indexOf(targetFolderId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newIds = [...currentIds];
    newIds.splice(draggedIndex, 1);
    newIds.splice(targetIndex, 0, draggedFolderId);

    reorderFolders(newIds);
  };

  const handleFolderDragEnd = () => {
    draggedFolderIdRef.current = null;
    setDragOverFolderId(null);
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
      moveDocumentToFolder(docId, '');
    }
  };

  // 处理未分类文档重排序
  const handleUncategorizedReorder = (ids: string[]) => {
    // 获取未分类文档的完整排序（保留文件夹内文档的顺序）
    const folderDocIds = documents.filter(d => d.folderId).map(d => d.id);
    reorderDocuments([...ids, ...folderDocIds]);
  };

  // 处理文件夹内文档重排序
  const handleFolderDocReorder = (folderId: string) => (ids: string[]) => {
    // 保留其他文档的顺序，只更新该文件夹内的文档
    const uncategorizedIds = uncategorizedDocs.sort((a, b) => a.order - b.order).map(d => d.id);
    const otherFolderDocs = documents
      .filter(d => d.folderId && d.folderId !== folderId)
      .sort((a, b) => a.order - b.order)
      .map(d => d.id);
    reorderDocuments([...uncategorizedIds, ...ids, ...otherFolderDocs]);
  };

  return (
    <>
      <aside className={`sidebar ${theme} ${collapsed ? 'sidebar-hidden' : ''}`}>

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
                  onClick={handleCreateFolder}
                  title={STRINGS.TOOLTIPS.NEW_FOLDER}
                >
                  <Plus size={14} />
                </button>
              </div>
              {sortedFolders.map((folder) => (
                <div
                  key={folder.id}
                  className={`folder-wrapper ${dragOverFolderId === folder.id ? 'drag-over-folder' : ''}`}
                  draggable={editingFolderId !== folder.id}
                  onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                  onDragEnd={handleFolderDragEnd}
                >
                  <FolderItem
                    folder={folder}
                    documents={getDocumentsInFolder(folder.id)}
                    activeDocId={activeExternalPath ? null : activeId}
                    onToggle={() => toggleFolderCollapsed(folder.id)}
                    onRename={(name) => renameFolder(folder.id, name)}
                    onDelete={() => handleDeleteFolderClick(folder.id)}
                    onSelectDocument={handleSelect}
                    onDeleteDocument={handleDeleteClick}
                    onMoveDocument={moveDocumentToFolder}
                    onReorderDocuments={handleFolderDocReorder(folder.id)}
                    onEditingChange={(isEditing) => setEditingFolderId(isEditing ? folder.id : null)}
                    onAddDocument={() => handleCreateInFolder(folder.id)}
                  />
                </div>
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
                    onClick={handleCreate}
                    title={STRINGS.TOOLTIPS.NEW_DOC}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <ul className="document-list">
                <DocumentList
                  items={displayList}
                  activeId={activeExternalPath ? null : activeId}
                  isSearchMode={!!query}
                  onSelect={handleSelect}
                  onDelete={handleDeleteClick}
                  draggable={!query}
                  onReorder={handleUncategorizedReorder}
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
