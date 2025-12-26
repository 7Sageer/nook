import { useMemo, useState, useCallback } from 'react';
import type { DocumentMeta, Folder } from '../types/document';
import type { ExternalFileInfo } from '../types/external-file';
import { useSettings } from '../contexts/SettingsContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { useSidebarDnd } from '../hooks/useSidebarDnd';
import { DocumentList } from './DocumentList';
import { SidebarExternalFiles } from './SidebarExternalFiles';
import { SidebarDragOverlay } from './SidebarDragOverlay';
import { SidebarSearch } from './SidebarSearch';
import { SortableFolderWrapper } from './SortableFolderWrapper';
import { Plus } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  DndContext,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
    addTag,
    removeTag,
  } = useDocumentContext();
  const { theme, language } = useSettings();
  const STRINGS = getStrings(language);
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
    await createDoc(STRINGS.DEFAULTS.UNTITLED, folderId);
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
      <aside
        className={`sidebar ${theme} ${collapsed ? 'sidebar-hidden' : ''}`}
        role="complementary"
        aria-label={STRINGS.LABELS.SIDEBAR}
      >
        <SidebarSearch query={query} onQueryChange={setQuery} />

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
          <LayoutGroup>
            <div className={`sidebar-content ${isDragging ? 'is-dragging' : ''}`}>
              {/* 文件夹列表 */}
              {!query && folders.length > 0 && (
                <div className="folders-section" role="tree" aria-label={STRINGS.LABELS.FOLDERS}>
                  <div className="section-label-row">
                    <span className="section-label">{STRINGS.LABELS.FOLDERS}</span>
                    <button
                      className="section-add-btn"
                      onClick={handleCreateFolder}
                      title={STRINGS.TOOLTIPS.NEW_FOLDER}
                      aria-label={STRINGS.TOOLTIPS.NEW_FOLDER}
                    >
                      <Plus size={14} aria-hidden="true" />
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
                          onAddTag={addTag}
                          onRemoveTag={removeTag}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                </div>
              )}

              {/* 未分类文档列表 */}
              {(displayList.length > 0 || query) && (
                <motion.div
                  ref={setUncategorizedDroppableRef}
                  className="uncategorized-section"
                  layout={!isDragging ? 'position' : false}
                >
                  {/* 当有文件夹时显示分隔线，搜索模式下显示标题 */}
                  {query ? (
                    <div className="section-label-row">
                      <span className="section-label">{STRINGS.LABELS.DOCUMENTS}</span>
                      <button
                        className="section-add-btn"
                        onClick={handleCreate}
                        title={STRINGS.TOOLTIPS.NEW_DOC}
                        aria-label={STRINGS.TOOLTIPS.NEW_DOC}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="section-label-row docs-section-header">
                      {folders.length > 0 && <hr className="section-divider" />}
                      <button
                        className="section-add-btn"
                        onClick={handleCreate}
                        title={STRINGS.TOOLTIPS.NEW_DOC}
                        aria-label={STRINGS.TOOLTIPS.NEW_DOC}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <ul
                    className={`document-list ${!query && containerDropIndicator?.containerId === UNCATEGORIZED_CONTAINER_ID ? 'drop-before' : ''
                      }`}
                    role="listbox"
                    aria-label={STRINGS.LABELS.DOCUMENTS}
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
                      onAddTag={addTag}
                      onRemoveTag={removeTag}
                    />
                  </ul>
                </motion.div>
              )}
            </div>
          </LayoutGroup>

          <SidebarDragOverlay
            activeDragItem={activeDragItem}
            documents={documents}
            folders={folders}
            docsByContainer={docsByContainer}
          />
        </DndContext>
      </aside >

      <ConfirmModalComponent />
    </>
  );
}
