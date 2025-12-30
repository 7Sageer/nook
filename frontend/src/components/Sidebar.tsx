import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentMeta, TagInfo } from '../types/document';
import type { ExternalFileInfo } from '../types/external-file';
import { useSettings } from '../contexts/SettingsContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { useSidebarDnD } from '../hooks/useSidebarDnD';
import { SidebarExternalFiles } from './SidebarExternalFiles';
import { SidebarSearch, SidebarSearchRef } from './SidebarSearch';
import { SidebarSearchResults } from './SidebarSearchResults';
import { SidebarTagGroups } from './SidebarTagGroups';
import { TagList } from './TagList';
import { FileText, GripVertical } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { LayoutGroup } from 'framer-motion';
import { DndContext, DragOverlay } from '@dnd-kit/core';

interface SidebarProps {
  externalFiles?: ExternalFileInfo[];
  activeExternalPath?: string | null;
  onSelectExternal?: (path: string) => void;
  onCloseExternal?: (path: string) => void;
  collapsed?: boolean;
  onSelectInternal?: (id: string, blockId?: string) => void;
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
    tagGroups,
    createDoc,
    deleteDoc,
    switchDoc,
    reorderDocuments,
    createTagGroup,
    deleteTagGroup,
    renameTagGroup,
    toggleTagGroupCollapsed,
    addTag,
    removeTag,
    allTags,
    selectedTag,
    setSelectedTag,
    tagColors,
  } = useDocumentContext();
  const { theme, language } = useSettings();
  const STRINGS = getStrings(language);
  const { query, results, semanticResults, isSearching, isLoadingSemantic, setQuery, clearSearch } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const searchRef = useRef<SidebarSearchRef>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);

  // Global Keyboard Shortcut for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        if (!query) {
          clearSearch();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSearch, query]);

  // Sort tag groups by order
  const sortedGroups = useMemo(() => {
    return [...tagGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tagGroups]);

  // Get group names set for quick lookup
  const groupNameSet = useMemo(() => new Set(tagGroups.map(g => g.name)), [tagGroups]);

  // Group documents by tag groups
  const { docsByGroup, ungroupedDocs } = useMemo(() => {
    const docsByGroup = new Map<string, DocumentMeta[]>();
    const ungroupedDocs: DocumentMeta[] = [];

    // Initialize all groups
    for (const group of sortedGroups) {
      docsByGroup.set(group.name, []);
    }

    // Categorize documents - a doc can appear in multiple groups
    for (const doc of documents) {
      const docTags = doc.tags || [];
      const matchingGroups = docTags.filter(t => groupNameSet.has(t));

      if (matchingGroups.length > 0) {
        for (const groupName of matchingGroups) {
          const list = docsByGroup.get(groupName);
          if (list) {
            list.push(doc);
          }
        }
      } else {
        ungroupedDocs.push(doc);
      }
    }

    // Sort documents in each group
    for (const [, docs] of docsByGroup) {
      docs.sort((a, b) => a.order - b.order);
    }
    ungroupedDocs.sort((a, b) => a.order - b.order);

    return { docsByGroup, ungroupedDocs };
  }, [documents, sortedGroups, groupNameSet]);

  // Filter by selected tag
  const filteredDocsByGroup = useMemo(() => {
    if (!selectedTag) return docsByGroup;
    const filtered = new Map<string, DocumentMeta[]>();
    for (const [groupName, docs] of docsByGroup) {
      filtered.set(groupName, docs.filter(doc => doc.tags?.includes(selectedTag)));
    }
    return filtered;
  }, [docsByGroup, selectedTag]);

  const tagFilteredUngrouped = selectedTag
    ? ungroupedDocs.filter(doc => doc.tags?.includes(selectedTag))
    : ungroupedDocs;

  // Filter allTags to show only non-group tags in Tag section
  const regularTags = useMemo(() => {
    return allTags.filter(t => !t.isGroup);
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
    groupNameSet,
    ungroupedDocs,
    filteredDocsByGroup,
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
    if (onSelectInternal) {
      onSelectInternal(docId, blockId);
    } else {
      switchDoc(docId);
    }
  }, [onSelectInternal, switchDoc]);

  const handleCreate = useCallback(() => {
    createDoc();
  }, [createDoc]);

  const handleCreateInGroup = useCallback(async (groupName: string) => {
    await createDoc(STRINGS.DEFAULTS.UNTITLED, groupName);
  }, [createDoc, STRINGS.DEFAULTS.UNTITLED]);

  const handleCreateGroup = useCallback(() => {
    createTagGroup();
  }, [createTagGroup]);

  const handleDeleteClick = useCallback((id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TITLE,
        message: STRINGS.MODALS.DELETE_MESSAGE,
      },
      () => deleteDoc(id)
    );
  }, [openModal, STRINGS.MODALS, deleteDoc]);

  const handleDeleteGroupClick = useCallback((name: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_GROUP_TITLE,
        message: STRINGS.MODALS.DELETE_GROUP_MESSAGE,
      },
      () => deleteTagGroup(name)
    );
  }, [openModal, STRINGS.MODALS, deleteTagGroup]);

  return (
    <>
      <aside
        className={`sidebar ${theme} ${collapsed ? 'sidebar-hidden' : ''}`}
        role="complementary"
        aria-label={STRINGS.LABELS.SIDEBAR}
      >
        <SidebarSearch ref={searchRef} query={query} onQueryChange={setQuery} />

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
              {query ? (
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
                <SidebarTagGroups
                  sortedGroups={sortedGroups}
                  filteredDocsByGroup={filteredDocsByGroup}
                  tagFilteredUngrouped={tagFilteredUngrouped}
                  activeDocId={activeId}
                  activeExternalPath={activeExternalPath ?? null}
                  isDragging={isDragging}
                  editingGroupName={editingGroupName}
                  hasQuery={!!query}
                  onToggleCollapsed={toggleTagGroupCollapsed}
                  onRenameGroup={renameTagGroup}
                  onDeleteGroup={handleDeleteGroupClick}
                  onSelectDocument={handleSelect}
                  onDeleteDocument={handleDeleteClick}
                  onEditingChange={setEditingGroupName}
                  onAddDocumentToGroup={handleCreateInGroup}
                  onCreateGroup={handleCreateGroup}
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
