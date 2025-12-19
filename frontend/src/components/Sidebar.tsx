import { useMemo, useState, useCallback } from 'react';
import type { DocumentMeta, Folder } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { useSidebarDnd } from '../hooks/useSidebarDnd';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { SidebarExternalFiles } from './SidebarExternalFiles';
import { SidebarDragOverlay } from './SidebarDragOverlay';
import { Search, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  UNCATEGORIZED_CONTAINER_ID,
  folderDndId,
  docContainerDndId,
} from '../utils/dnd';

interface SidebarProps {
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onSelectExternal?: (path: string) => void;
  onCloseExternal?: (path: string) => void;
  collapsed?: boolean;
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

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 排序后的文件夹
  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => a.order - b.order);
  }, [folders]);

  const folderIdSet = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  const { docIdsByContainer, docsByContainer, containerIdByDocId } = useMemo(() => {
    const originalIndexById = new Map(documents.map((doc, index) => [doc.id, index]));
    const compareDocs = (a: typeof documents[number], b: typeof documents[number]) => {
      if (a.order !== b.order) return a.order - b.order;
      return (originalIndexById.get(a.id) ?? 0) - (originalIndexById.get(b.id) ?? 0);
    };

    const containerIdByDocId = new Map<string, string>();
    const docsByContainer = new Map<string, DocumentMeta[]>();

    const ensureContainer = (containerId: string) => {
      if (!docsByContainer.has(containerId)) docsByContainer.set(containerId, []);
    };

    ensureContainer(UNCATEGORIZED_CONTAINER_ID);
    for (const folder of sortedFolders) {
      ensureContainer(folder.id);
    }

    for (const doc of documents) {
      const containerId =
        doc.folderId && folderIdSet.has(doc.folderId) ? doc.folderId : UNCATEGORIZED_CONTAINER_ID;
      containerIdByDocId.set(doc.id, containerId);
      ensureContainer(containerId);
      docsByContainer.get(containerId)!.push(doc);
    }

    const docIdsByContainer = new Map<string, string[]>();
    const sortedDocsByContainer = new Map<string, DocumentMeta[]>();
    for (const [containerId, containerDocs] of docsByContainer) {
      const sortedDocs = [...containerDocs].sort(compareDocs);
      sortedDocsByContainer.set(containerId, sortedDocs);
      docIdsByContainer.set(containerId, sortedDocs.map((doc) => doc.id));
    }

    return { docIdsByContainer, docsByContainer: sortedDocsByContainer, containerIdByDocId };
  }, [documents, folderIdSet, sortedFolders]);

  // 使用提取的 DnD hook
  const {
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    docDropIndicator,
    containerDropIndicator,
    activeDragItem,
    justDroppedId,
  } = useSidebarDnd({
    sortedFolders,
    containerIdByDocId,
    docIdsByContainer,
    folderIdSet,
    moveDocumentToFolder,
    reorderDocuments,
    reorderFolders,
  });

  const uncategorizedDocs = docsByContainer.get(UNCATEGORIZED_CONTAINER_ID)!;
  const displayList = query ? results : uncategorizedDocs;

  const { setNodeRef: setUncategorizedDroppableRef } = useDroppable({
    id: docContainerDndId(UNCATEGORIZED_CONTAINER_ID),
    data: { type: 'doc-container', containerId: UNCATEGORIZED_CONTAINER_ID },
    disabled: !!query,
  });

  // 事件处理
  const handleSelect = useCallback((id: string) => {
    if (onSelectInternal) {
      onSelectInternal(id);
    } else {
      switchDoc(id);
    }
  }, [onSelectInternal, switchDoc]);

  const handleCreate = useCallback(() => {
    createDoc();
  }, [createDoc]);

  const handleCreateInFolder = useCallback(async (folderId: string) => {
    await createDoc('无标题', folderId);
  }, [createDoc]);

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

        <SidebarExternalFiles
          externalFiles={externalFiles}
          activeExternalPath={activeExternalPath ?? null}
          onSelectExternal={onSelectExternal}
          onCloseExternal={onCloseExternal}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={(e) => {
            setIsDragging(true);
            handleDragStart(e);
          }}
          onDragMove={handleDragMove}
          onDragEnd={(e) => {
            setIsDragging(false);
            handleDragEnd(e);
          }}
          onDragCancel={() => {
            setIsDragging(false);
            handleDragCancel();
          }}
        >
          <div className={`sidebar-content ${isDragging ? 'is-dragging' : ''}`}>
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
                <SortableContext
                  items={sortedFolders.map((folder) => folderDndId(folder.id))}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence mode="popLayout">
                    {sortedFolders.map((folder, index) => (
                      <SortableFolderWrapper
                        key={folder.id}
                        folder={folder}
                        index={index}
                        documents={docsByContainer.get(folder.id)!}
                        disabled={editingFolderId === folder.id}
                        activeDocId={activeExternalPath ? null : activeId}
                        onToggleFolder={toggleFolderCollapsed}
                        onRenameFolder={renameFolder}
                        onDeleteFolder={handleDeleteFolderClick}
                        onSelectDocument={handleSelect}
                        onDeleteDocument={handleDeleteClick}
                        onEditingFolderChange={setEditingFolderId}
                        onAddDocumentInFolder={handleCreateInFolder}
                        dropIndicator={docDropIndicator}
                        containerDropIndicator={containerDropIndicator}
                        justDroppedId={justDroppedId}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </div>
            )}

            {/* 未分类文档列表 */}
            {(displayList.length > 0 || query) && (
              <div
                ref={setUncategorizedDroppableRef}
                className="uncategorized-section"
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
                <ul
                  className={`document-list ${!query && containerDropIndicator?.containerId === UNCATEGORIZED_CONTAINER_ID ? 'drop-before' : ''
                    }`}
                >
                  <DocumentList
                    items={displayList}
                    activeId={activeExternalPath ? null : activeId}
                    isSearchMode={!!query}
                    onSelect={handleSelect}
                    onDelete={handleDeleteClick}
                    sortable={!query}
                    containerId={UNCATEGORIZED_CONTAINER_ID}
                    dropIndicator={docDropIndicator}
                    justDroppedId={justDroppedId}
                  />
                </ul>
              </div>
            )}
          </div>

          <SidebarDragOverlay
            activeDragItem={activeDragItem}
            documents={documents}
            folders={folders}
            docsByContainer={docsByContainer}
          />
        </DndContext>
      </aside>

      <ConfirmModalComponent />
    </>
  );
}

// ========== SortableFolderWrapper ==========

const folderVariants = {
  initial: { opacity: 0, x: -12 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
  exit: {
    opacity: 0,
    x: -20,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

function SortableFolderWrapper({
  folder,
  index,
  documents,
  disabled,
  activeDocId,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onSelectDocument,
  onDeleteDocument,
  onEditingFolderChange,
  onAddDocumentInFolder,
  dropIndicator,
  containerDropIndicator,
  justDroppedId,
}: {
  folder: Folder;
  index: number;
  documents: DocumentMeta[];
  disabled: boolean;
  activeDocId: string | null;
  onToggleFolder: (folderId: string) => Promise<void> | void;
  onRenameFolder: (folderId: string, name: string) => Promise<void> | void;
  onDeleteFolder: (folderId: string) => void;
  onSelectDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onEditingFolderChange: (folderId: string | null) => void;
  onAddDocumentInFolder: (folderId: string) => Promise<void> | void;
  dropIndicator?: { docId: string; position: 'before' | 'after' } | null;
  containerDropIndicator?: { containerId: string } | null;
  justDroppedId?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderDndId(folder.id),
    disabled,
    data: { type: 'folder', folderId: folder.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const folderDragHandleProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners]
  );

  const handleToggle = useCallback(() => {
    void onToggleFolder(folder.id);
  }, [onToggleFolder, folder.id]);

  const handleRename = useCallback(
    (name: string) => {
      void onRenameFolder(folder.id, name);
    },
    [onRenameFolder, folder.id]
  );

  const handleDelete = useCallback(() => {
    onDeleteFolder(folder.id);
  }, [onDeleteFolder, folder.id]);

  const handleEditingChange = useCallback(
    (isEditing: boolean) => {
      onEditingFolderChange(isEditing ? folder.id : null);
    },
    [onEditingFolderChange, folder.id]
  );

  const handleAddDocument = useCallback(() => {
    void onAddDocumentInFolder(folder.id);
  }, [onAddDocumentInFolder, folder.id]);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      variants={folderVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={index}
      className={`folder-wrapper sortable ${isDragging ? 'is-dragging' : ''}`}
    >
      <FolderItem
        folder={folder}
        documents={documents}
        activeDocId={activeDocId}
        onToggle={handleToggle}
        onRename={handleRename}
        onDelete={handleDelete}
        onSelectDocument={onSelectDocument}
        onDeleteDocument={onDeleteDocument}
        onEditingChange={handleEditingChange}
        onAddDocument={handleAddDocument}
        folderDragHandleProps={folderDragHandleProps}
        dropIndicator={dropIndicator}
        containerDropIndicator={containerDropIndicator}
        justDroppedId={justDroppedId}
      />
    </motion.div>
  );
}
