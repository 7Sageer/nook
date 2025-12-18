import { DocumentMeta, Folder } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { Search, FileText, X, Plus } from 'lucide-react';
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
  externalFiles = [],
  activeExternalPath,
  onCloseExternal,
}: SidebarProps) {
  const { theme } = useTheme();
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();



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

  return (
    <>
      <aside className={`sidebar ${theme}`}>

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
