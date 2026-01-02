import { useMemo, useState, useCallback, useRef } from 'react';
import type { DocumentMeta } from '../types/document';
import type { ExternalFileInfo } from '../types/external-file';
import { useSettings } from '../contexts/SettingsContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { useSidebarDnD } from '../hooks/useSidebarDnD';
import { SidebarExternalFiles } from './SidebarExternalFiles';
import { SidebarSearch, SidebarSearchRef } from './SidebarSearch';
import { SidebarSearchResults } from './SidebarSearchResults';
import { SidebarPinnedTags } from './SidebarPinnedTags';
import { RelatedDocumentsView } from './RelatedDocumentsView';
import type { DocumentSearchResult } from '../types/document';
import { TagList } from './TagList';
import { FileText, GripVertical } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { LayoutGroup } from 'framer-motion';
import { DndContext, DragOverlay } from '@dnd-kit/core';

interface RelatedViewState {
  sourceContent: string;
  results: DocumentSearchResult[];
  isLoading: boolean;
}

interface SidebarProps {
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onSelectExternal?: (path: string) => void;
  onCloseExternal?: (path: string) => void;
  collapsed?: boolean;
  onSelectInternal?: (id: string, blockId?: string) => void;
  relatedView?: RelatedViewState | null;
  onExitRelatedView?: () => void;
}

export function Sidebar({
  externalFiles = [],
  activeExternalPath,
  onSelectExternal,
  onCloseExternal,
  collapsed = false,
  onSelectInternal,
  relatedView,
  onExitRelatedView,
}: SidebarProps) {
  const {
    documents,
    activeId,
    pinnedTags,
    createDoc,
    deleteDoc,
    switchDoc,
    reorderDocuments,
    pinTag,
    unpinTag,
    deleteTag,
    renameTag,
    togglePinnedTagCollapsed,
    addTag,
    removeTag,
    allTags,
    selectedTag,
    setSelectedTag,
    tagColors,
    setTagColor,
  } = useDocumentContext();
  const { theme, language } = useSettings();
  const STRINGS = getStrings(language);
  const { query, results, semanticResults, isSearching, isLoadingSemantic, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const searchRef = useRef<SidebarSearchRef>(null);
  const [editingTagName, setEditingTagName] = useState<string | null>(null);

  // Sort pinned tags by order and merge colors
  const sortedPinnedTags = useMemo(() => {
    return [...pinnedTags]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(tag => ({
        ...tag,
        color: tagColors[tag.name] || tag.color,
      }));
  }, [pinnedTags, tagColors]);

  // Get pinned tag names set for quick lookup
  const pinnedTagNameSet = useMemo(() => new Set(pinnedTags.map(t => t.name)), [pinnedTags]);

  // Group documents by pinned tags
  const { docsByPinnedTag, ungroupedDocs } = useMemo(() => {
    const docsByPinnedTag = new Map<string, DocumentMeta[]>();
    const ungroupedDocs: DocumentMeta[] = [];

    // Initialize all pinned tags
    for (const tag of sortedPinnedTags) {
      docsByPinnedTag.set(tag.name, []);
    }

    // Categorize documents - a doc can appear in multiple pinned tags
    for (const doc of documents) {
      const docTags = doc.tags || [];
      const matchingPinnedTags = docTags.filter(t => pinnedTagNameSet.has(t));

      if (matchingPinnedTags.length > 0) {
        for (const tagName of matchingPinnedTags) {
          const list = docsByPinnedTag.get(tagName);
          if (list) {
            list.push(doc);
          }
        }
      } else {
        ungroupedDocs.push(doc);
      }
    }

    // Sort documents in each pinned tag
    for (const [, docs] of docsByPinnedTag) {
      docs.sort((a, b) => a.order - b.order);
    }
    ungroupedDocs.sort((a, b) => a.order - b.order);

    return { docsByPinnedTag, ungroupedDocs };
  }, [documents, sortedPinnedTags, pinnedTagNameSet]);

  // Filter by selected tag
  const filteredDocsByTag = useMemo(() => {
    if (!selectedTag) return docsByPinnedTag;
    const filtered = new Map<string, DocumentMeta[]>();
    for (const [tagName, docs] of docsByPinnedTag) {
      filtered.set(tagName, docs.filter(doc => doc.tags?.includes(selectedTag)));
    }
    return filtered;
  }, [docsByPinnedTag, selectedTag]);

  const tagFilteredUngrouped = selectedTag
    ? ungroupedDocs.filter(doc => doc.tags?.includes(selectedTag))
    : ungroupedDocs;

  // Filter allTags to show only non-pinned tags in Tag section
  const regularTags = useMemo(() => {
    return allTags.filter(t => !t.isPinned);
  }, [allTags]);

  // Use extracted DnD hook
  const {
    isDragging,
    activeDragDocId,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useSidebarDnD({
    groupNameSet: pinnedTagNameSet,
    ungroupedDocs,
    filteredDocsByGroup: filteredDocsByTag,
    addTag,
    removeTag,
    reorderDocuments,
  });

  // Event handlers
  const handleSelect = useCallback((id: string) => {
    if (onSelectInternal) {
      onSelectInternal(id);
    } else {
      switchDoc(id);
    }
  }, [onSelectInternal, switchDoc]);

  const handleSelectSemantic = useCallback((docId: string, blockId: string) => {
    console.log('[Sidebar] handleSelectSemantic called:', { docId, blockId, hasOnSelectInternal: !!onSelectInternal });
    if (onSelectInternal) {
      onSelectInternal(docId, blockId);
    } else {
      switchDoc(docId);
    }
  }, [onSelectInternal, switchDoc]);

  const handleCreate = useCallback(() => {
    createDoc();
  }, [createDoc]);

  const handleCreateInPinnedTag = useCallback(async (tagName: string) => {
    await createDoc(STRINGS.DEFAULTS.UNTITLED, tagName);
  }, [createDoc, STRINGS.DEFAULTS.UNTITLED]);

  const handleCreatePinnedTag = useCallback(() => {
    // 创建新的固定标签需要先输入名称，这里暂时使用默认名称
    pinTag(STRINGS.DEFAULTS.NEW_PINNED_TAG);
  }, [pinTag, STRINGS.DEFAULTS.NEW_PINNED_TAG]);

  const handleDeleteClick = useCallback((id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TITLE,
        message: STRINGS.MODALS.DELETE_MESSAGE,
      },
      () => deleteDoc(id)
    );
  }, [openModal, STRINGS.MODALS, deleteDoc]);

  const handleDeleteTagClick = useCallback((name: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TAG_TITLE,
        message: STRINGS.MODALS.DELETE_TAG_MESSAGE,
      },
      () => deleteTag(name)
    );
  }, [openModal, STRINGS.MODALS, deleteTag]);

  return (
    <>
      <aside
        className={`sidebar ${theme} ${collapsed ? 'sidebar-hidden' : ''}`}
        role="complementary"
        aria-label={STRINGS.LABELS.SIDEBAR}
      >
        <SidebarSearch ref={searchRef} onQueryChange={setQuery} />

        <SidebarExternalFiles
          externalFiles={externalFiles}
          activeExternalPath={activeExternalPath ?? null}
          onSelectExternal={onSelectExternal}
          onCloseExternal={onCloseExternal}
        />

        {!query && regularTags.length > 0 && (
          <TagList
            tags={regularTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            tagColors={tagColors}
          />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <LayoutGroup>
            <div className={`sidebar-content ${isDragging ? 'is-dragging' : ''}`}>
              {relatedView ? (
                <RelatedDocumentsView
                  sourceContent={relatedView.sourceContent}
                  results={relatedView.results}
                  isLoading={relatedView.isLoading}
                  onSelectDocument={handleSelectSemantic}
                  onBack={onExitRelatedView || (() => { })}
                />
              ) : query ? (
                <SidebarSearchResults
                  query={query}
                  semanticResults={semanticResults}
                  keywordResults={results}
                  isLoadingSemantic={isLoadingSemantic}
                  isSearching={isSearching}
                  activeId={activeId}
                  activeExternalPath={activeExternalPath ?? null}
                  onSelectSemantic={handleSelectSemantic}
                  onSelectKeyword={handleSelect}
                  strings={STRINGS}
                />
              ) : (
                <SidebarPinnedTags
                  pinnedTags={sortedPinnedTags}
                  filteredDocsByTag={filteredDocsByTag}
                  tagFilteredUngrouped={tagFilteredUngrouped}
                  activeDocId={activeId}
                  activeExternalPath={activeExternalPath ?? null}
                  isDragging={isDragging}
                  editingTagName={editingTagName}
                  hasQuery={!!query}
                  onToggleCollapsed={togglePinnedTagCollapsed}
                  onRenameTag={renameTag}
                  onDeleteTag={handleDeleteTagClick}
                  onUnpinTag={unpinTag}
                  onColorSelect={setTagColor}
                  onSelectDocument={handleSelect}
                  onDeleteDocument={handleDeleteClick}
                  onEditingChange={setEditingTagName}
                  onAddDocumentToTag={handleCreateInPinnedTag}
                  onCreatePinnedTag={handleCreatePinnedTag}
                  onCreateDocument={handleCreate}
                  strings={STRINGS}
                />
              )}
            </div>
          </LayoutGroup>

          {/* Drag Overlay - shows the document being dragged */}
          <DragOverlay dropAnimation={null}>
            {activeDragDocId && (() => {
              const doc = documents.find(d => d.id === activeDragDocId);
              if (!doc) return null;
              return (
                <div className="document-item drag-overlay">
                  <div className="drag-handle visible">
                    <GripVertical size={14} aria-hidden="true" />
                  </div>
                  <FileText size={16} className="doc-icon" />
                  <div className="doc-content">
                    <span className="doc-title">{doc.title}</span>
                  </div>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>
      </aside >

      <ConfirmModalComponent />
    </>
  );
}
