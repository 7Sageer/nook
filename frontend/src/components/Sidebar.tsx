import { useMemo, useState, useRef } from 'react';
import { DocumentMeta, Folder } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { Search, FileText, X, Plus, GripVertical } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarProps {
  documents: DocumentMeta[];
  folders: Folder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSelectExternal?: (path: string) => void;
  onCreate: () => void;
  onCreateInFolder?: (folderId: string) => void;
  onCreateFolder: () => void;
  onDelete: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  onMoveToFolder: (docId: string, folderId: string) => void;
  onReorderDocuments?: (ids: string[]) => void;
  onReorderFolders?: (ids: string[]) => void;
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onCloseExternal?: (path: string) => void;
  collapsed?: boolean;
}

export function Sidebar({
  documents,
  folders,
  activeId,
  onSelect,
  onSelectExternal,
  onCreate,
  onCreateInFolder,
  onCreateFolder,
  onDelete,
  onDeleteFolder,
  onRenameFolder,
  onToggleFolder,
  onMoveToFolder,
  onReorderDocuments,
  onReorderFolders,
  externalFiles = [],
  activeExternalPath,
  onCloseExternal,
  collapsed = false,
}: SidebarProps) {
  const { theme } = useTheme();
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const draggedFolderIdRef = useRef<string | null>(null);

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

    if (!draggedFolderId || draggedFolderId === targetFolderId || !onReorderFolders) return;

    const currentIds = sortedFolders.map(f => f.id);
    const draggedIndex = currentIds.indexOf(draggedFolderId);
    const targetIndex = currentIds.indexOf(targetFolderId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newIds = [...currentIds];
    newIds.splice(draggedIndex, 1);
    newIds.splice(targetIndex, 0, draggedFolderId);

    onReorderFolders(newIds);
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
      onMoveToFolder(docId, '');
    }
  };

  // 处理未分类文档重排序
  const handleUncategorizedReorder = (ids: string[]) => {
    // 获取未分类文档的完整排序（保留文件夹内文档的顺序）
    const folderDocIds = documents.filter(d => d.folderId).map(d => d.id);
    onReorderDocuments?.([...ids, ...folderDocIds]);
  };

  // 处理文件夹内文档重排序
  const handleFolderDocReorder = (folderId: string) => (ids: string[]) => {
    // 保留其他文档的顺序，只更新该文件夹内的文档
    const uncategorizedIds = uncategorizedDocs.sort((a, b) => a.order - b.order).map(d => d.id);
    const otherFolderDocs = documents
      .filter(d => d.folderId && d.folderId !== folderId)
      .sort((a, b) => a.order - b.order)
      .map(d => d.id);
    onReorderDocuments?.([...uncategorizedIds, ...ids, ...otherFolderDocs]);
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
                  onClick={onCreateFolder}
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
                    activeDocId={activeId}
                    onToggle={() => onToggleFolder(folder.id)}
                    onRename={(name) => onRenameFolder(folder.id, name)}
                    onDelete={() => handleDeleteFolderClick(folder.id)}
                    onSelectDocument={onSelect}
                    onDeleteDocument={handleDeleteClick}
                    onMoveDocument={onMoveToFolder}
                    onReorderDocuments={handleFolderDocReorder(folder.id)}
                    onEditingChange={(isEditing) => setEditingFolderId(isEditing ? folder.id : null)}
                    onAddDocument={onCreateInFolder ? () => onCreateInFolder(folder.id) : undefined}
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
