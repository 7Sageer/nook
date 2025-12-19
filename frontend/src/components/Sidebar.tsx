import { useMemo, useState, useCallback } from 'react';
import type { DocumentMeta, Folder } from '../types/document';
import { ExternalFileInfo } from '../hooks/useExternalFile';
import { useTheme } from '../contexts/ThemeContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { FolderItem } from './FolderItem';
import { Search, FileText, X, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';
import {
  closestCenter,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  UNCATEGORIZED_CONTAINER_ID,
  docContainerDndId,
  isDocContainerDndId,
  isDocDndId,
  isFolderDndId,
  parseDocContainerId,
  parseDocId,
  parseFolderId,
  folderDndId,
} from '../utils/dnd';

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

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [docDropIndicator, setDocDropIndicator] = useState<{
    docId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [containerDropIndicator, setContainerDropIndicator] = useState<{
    containerId: string;
  } | null>(null);

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

  const uncategorizedDocs = docsByContainer.get(UNCATEGORIZED_CONTAINER_ID)!;
  const displayList = query ? results : uncategorizedDocs;

  const { setNodeRef: setUncategorizedDroppableRef } = useDroppable({
    id: docContainerDndId(UNCATEGORIZED_CONTAINER_ID),
    data: { type: 'doc-container', containerId: UNCATEGORIZED_CONTAINER_ID },
    disabled: !!query,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);

    if (isFolderDndId(activeId)) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          isFolderDndId(String(container.id))
        ),
      });
    }

    if (isDocDndId(activeId)) {
      const docDroppables = args.droppableContainers.filter((container) => {
        const id = String(container.id);
        return isDocDndId(id) || isDocContainerDndId(id);
      });

      const pointerCollisions = pointerWithin({ ...args, droppableContainers: docDroppables });
      const pointerDocCollisions = pointerCollisions.filter((collision) =>
        isDocDndId(String(collision.id))
      );

      if (pointerDocCollisions.length > 0) return pointerDocCollisions;
      if (pointerCollisions.length > 0) return pointerCollisions;

      return rectIntersection({ ...args, droppableContainers: docDroppables });
    }

    return closestCenter(args);
  }, []);

  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
    },
    []
  );

  const handleDragMove = useCallback(({ active, over }: DragMoveEvent) => {
    const activeId = String(active.id);
    if (!isDocDndId(activeId) || !over) {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
      return;
    }

    const overId = String(over.id);

    if (isDocContainerDndId(overId)) {
      const containerId =
        (over.data.current as { containerId?: string } | null)?.containerId ?? parseDocContainerId(overId);
      if (!containerId) {
        setDocDropIndicator(null);
        setContainerDropIndicator(null);
        return;
      }

      setDocDropIndicator(null);
      setContainerDropIndicator({ containerId });
      return;
    }

    if (!isDocDndId(overId)) {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
      return;
    }

    const activeDocId = parseDocId(activeId);
    const overDocId = parseDocId(overId);
    if (!activeDocId || !overDocId || activeDocId === overDocId) {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
      return;
    }

    const activeRect = active.rect.current.translated ?? active.rect.current.initial;
    if (!activeRect) {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
      return;
    }

    const activeCenterY = activeRect.top + activeRect.height / 2;
    const overMiddleY = over.rect.top + over.rect.height / 2;
    const position: 'before' | 'after' = activeCenterY > overMiddleY ? 'after' : 'before';

    setDocDropIndicator((prev) => {
      if (prev?.docId === overDocId && prev.position === position) return prev;
      return { docId: overDocId, position };
    });
    setContainerDropIndicator(null);
  }, []);

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setDocDropIndicator(null);
      setContainerDropIndicator(null);
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      if (isFolderDndId(activeId) && isFolderDndId(overId)) {
        const activeFolderId = parseFolderId(activeId);
        const overFolderId = parseFolderId(overId);
        if (!activeFolderId || !overFolderId || activeFolderId === overFolderId) return;

        const currentIds = sortedFolders.map((f) => f.id);
        const oldIndex = currentIds.indexOf(activeFolderId);
        const newIndex = currentIds.indexOf(overFolderId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        await reorderFolders(arrayMove(currentIds, oldIndex, newIndex));
        return;
      }

      if (!isDocDndId(activeId)) return;

      const activeDocId = parseDocId(activeId);
      if (!activeDocId) return;

      const sourceContainerId =
        (active.data.current as { containerId?: string } | null)?.containerId ??
        containerIdByDocId.get(activeDocId) ??
        UNCATEGORIZED_CONTAINER_ID;

      const overContainerIdFromData = (over.data.current as { containerId?: string } | null)
        ?.containerId;

      const overContainerId =
        overContainerIdFromData ??
        (isDocContainerDndId(overId) ? parseDocContainerId(overId) : null) ??
        UNCATEGORIZED_CONTAINER_ID;

      if (!overContainerId) return;

      const overDocId = isDocDndId(overId) ? parseDocId(overId) : null;
      if (overDocId && overDocId === activeDocId && sourceContainerId === overContainerId) return;

      const cloneDocIdsByContainer = (source: Map<string, string[]>) => {
        const next = new Map<string, string[]>();
        for (const [containerId, ids] of source) {
          next.set(containerId, [...ids]);
        }
        return next;
      };

      const nextDocIdsByContainer = cloneDocIdsByContainer(docIdsByContainer);
      const sourceIds = nextDocIdsByContainer.get(sourceContainerId) ?? [];
      const targetIds = nextDocIdsByContainer.get(overContainerId) ?? [];

      const oldIndex = sourceIds.indexOf(activeDocId);

      const getInsertAfter = () => {
        const activeRect = active.rect.current.translated ?? active.rect.current.initial;
        if (!activeRect) return false;
        const activeCenterY = activeRect.top + activeRect.height / 2;
        const overMiddleY = over.rect.top + over.rect.height / 2;
        return activeCenterY > overMiddleY;
      };

      if (sourceContainerId === overContainerId) {
        if (oldIndex === -1) return;

        const nextIds = [...sourceIds];
        nextIds.splice(oldIndex, 1);

        const insertIndex = (() => {
          if (!overDocId) return 0;
          const overIndex = nextIds.indexOf(overDocId);
          if (overIndex === -1) return 0;
          return overIndex + (getInsertAfter() ? 1 : 0);
        })();

        nextIds.splice(insertIndex, 0, activeDocId);
        nextDocIdsByContainer.set(sourceContainerId, nextIds);
      } else {
        if (oldIndex === -1) return;

        const nextSourceIds = [...sourceIds];
        nextSourceIds.splice(oldIndex, 1);
        nextDocIdsByContainer.set(sourceContainerId, nextSourceIds);

        const nextTargetIds = [...targetIds];
        const insertIndex = (() => {
          if (!overDocId) return 0;
          const overIndex = nextTargetIds.indexOf(overDocId);
          if (overIndex === -1) return 0;
          return overIndex + (getInsertAfter() ? 1 : 0);
        })();
        nextTargetIds.splice(insertIndex, 0, activeDocId);
        nextDocIdsByContainer.set(overContainerId, nextTargetIds);

        await moveDocumentToFolder(
          activeDocId,
          overContainerId === UNCATEGORIZED_CONTAINER_ID ? '' : overContainerId
        );
      }

      const nextAllDocIds: string[] = [];
      const seen = new Set<string>();

      const pushAll = (ids: string[]) => {
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          nextAllDocIds.push(id);
        }
      };

      pushAll(nextDocIdsByContainer.get(UNCATEGORIZED_CONTAINER_ID) ?? []);
      for (const folder of sortedFolders) {
        pushAll(nextDocIdsByContainer.get(folder.id) ?? []);
      }
      for (const [containerId, ids] of nextDocIdsByContainer) {
        if (containerId === UNCATEGORIZED_CONTAINER_ID) continue;
        if (folderIdSet.has(containerId)) continue;
        pushAll(ids);
      }

      await reorderDocuments(nextAllDocIds);
    },
    [
      containerIdByDocId,
      docIdsByContainer,
      folderIdSet,
      moveDocumentToFolder,
      reorderDocuments,
      reorderFolders,
      sortedFolders,
    ]
  );

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
            <AnimatePresence mode="popLayout">
              {externalFiles.map((file) => {
                const isActive = activeExternalPath === file.path;
                return (
                  <motion.div
                    key={file.path}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
          }}
        >
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
                <SortableContext
                  items={sortedFolders.map((folder) => folderDndId(folder.id))}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedFolders.map((folder) => (
                    <SortableFolderWrapper
                      key={folder.id}
                      folder={folder}
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
                    />
                  ))}
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
                  className={`document-list ${
                    !query && containerDropIndicator?.containerId === UNCATEGORIZED_CONTAINER_ID ? 'drop-before' : ''
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
                  />
                </ul>
              </div>
            )}
          </div>
        </DndContext>
      </aside>

      <ConfirmModalComponent />
    </>
  );
}

function SortableFolderWrapper({
  folder,
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
}: {
  folder: Folder;
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
    <div
      ref={setNodeRef}
      style={style}
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
      />
    </div>
  );
}
