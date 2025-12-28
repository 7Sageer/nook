import { useMemo, useState, useCallback } from 'react';
import type { DocumentMeta, TagInfo } from '../types/document';
import type { ExternalFileInfo } from '../types/external-file';
import { useSettings } from '../contexts/SettingsContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useConfirmModal } from '../hooks/useConfirmModal';
import { useSearch } from '../hooks/useSearch';
import { DocumentList } from './DocumentList';
import { SidebarExternalFiles } from './SidebarExternalFiles';
import { SidebarSearch } from './SidebarSearch';
import { TagGroupItem } from './TagGroupItem';
import { TagList } from './TagList';
import { Plus } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { LayoutGroup, motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  useDroppable,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const UNCATEGORIZED_CONTAINER_ID = '__uncategorized__';

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
    tagGroups,
    createDoc,
    deleteDoc,
    switchDoc,
    reorderDocuments,
    createTagGroup,
    deleteTagGroup,
    renameTagGroup,
    toggleTagGroupCollapsed,
    reorderTagGroups,
    addTag,
    removeTag,
    allTags,
    selectedTag,
    setSelectedTag,
    tagColors,
  } = useDocumentContext();
  const { theme, language } = useSettings();
  const STRINGS = getStrings(language);
  const { query, results, setQuery } = useSearch();
  const { openModal, ConfirmModalComponent } = useConfirmModal();

  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        // Add to ALL matching groups
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
  const displayList = query ? results : tagFilteredUngrouped;

  // Filter allTags to show only non-group tags in Tag section
  const regularTags = useMemo(() => {
    return allTags.filter(t => !t.isGroup);
  }, [allTags]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const { setNodeRef: setUncategorizedDroppableRef } = useDroppable({
    id: `doc-container:${UNCATEGORIZED_CONTAINER_ID}`,
    data: { type: 'doc-container', containerId: UNCATEGORIZED_CONTAINER_ID },
    disabled: !!query,
  });

  // Event handlers
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

  const handleCreateInGroup = useCallback(async (groupName: string) => {
    await createDoc(STRINGS.DEFAULTS.UNTITLED, groupName);
  }, [createDoc, STRINGS.DEFAULTS.UNTITLED]);

  const handleCreateGroup = useCallback(() => {
    createTagGroup();
  }, [createTagGroup]);

  const handleDeleteClick = (id: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_TITLE,
        message: STRINGS.MODALS.DELETE_MESSAGE,
      },
      () => deleteDoc(id)
    );
  };

  const handleDeleteGroupClick = (name: string) => {
    openModal(
      {
        title: STRINGS.MODALS.DELETE_GROUP_TITLE,
        message: STRINGS.MODALS.DELETE_GROUP_MESSAGE,
      },
      () => deleteTagGroup(name)
    );
  };

  // Handle moving doc to group (add tag)
  const handleMoveDocToGroup = useCallback(async (docId: string, groupName: string) => {
    // Remove from any existing groups first
    const doc = documents.find(d => d.id === docId);
    if (doc?.tags) {
      for (const tag of doc.tags) {
        if (groupNameSet.has(tag)) {
          await removeTag(docId, tag);
        }
      }
    }
    // Add to new group
    if (groupName !== UNCATEGORIZED_CONTAINER_ID) {
      await addTag(docId, groupName);
    }
  }, [documents, groupNameSet, addTag, removeTag]);

  // Handle DnD end
  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping on a group container
    if (overId.startsWith('doc-container:')) {
      const groupName = overId.replace('doc-container:', '');
      handleMoveDocToGroup(activeId, groupName);
    }
  }, [handleMoveDocToGroup]);

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
          collisionDetection={closestCenter}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={(e) => {
            setIsDragging(false);
            handleDragEnd(e);
          }}
          onDragCancel={() => setIsDragging(false)}
        >
          <LayoutGroup>
            <div className={`sidebar-content ${isDragging ? 'is-dragging' : ''}`}>
              {/* Tag Groups Section */}
              {!query && sortedGroups.length > 0 && (
                <div className="folders-section" role="tree" aria-label={STRINGS.LABELS.GROUPS}>
                  <div className="section-label-row">
                    <span className="section-label">{STRINGS.LABELS.GROUPS}</span>
                    <button
                      className="section-add-btn"
                      onClick={handleCreateGroup}
                      title={STRINGS.TOOLTIPS.NEW_GROUP}
                      aria-label={STRINGS.TOOLTIPS.NEW_GROUP}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <SortableContext
                    items={sortedGroups.map(g => g.name)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence mode="popLayout">
                      {sortedGroups.map((group, index) => (
                        <TagGroupItem
                          key={group.name}
                          group={group}
                          index={index}
                          documents={filteredDocsByGroup.get(group.name) || []}
                          disabled={editingGroupName === group.name}
                          activeDocId={activeExternalPath ? null : activeId}
                          onToggle={toggleTagGroupCollapsed}
                          onRename={renameTagGroup}
                          onDelete={handleDeleteGroupClick}
                          onSelectDocument={handleSelect}
                          onDeleteDocument={handleDeleteClick}
                          onEditingChange={setEditingGroupName}
                          onAddDocument={handleCreateInGroup}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                </div>
              )}

              {/* Uncategorized Documents */}
              {(displayList.length > 0 || query) && (
                <motion.div
                  ref={setUncategorizedDroppableRef}
                  className="uncategorized-section"
                  layout={!isDragging ? 'position' : false}
                >
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
                      {sortedGroups.length > 0 && <hr className="section-divider" />}
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
                    className="document-list"
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
                    />
                  </ul>
                </motion.div>
              )}
            </div>
          </LayoutGroup>
        </DndContext>
      </aside>

      <ConfirmModalComponent />
    </>
  );
}
