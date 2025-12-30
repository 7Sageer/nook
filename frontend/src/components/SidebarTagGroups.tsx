import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TagGroupItem } from './TagGroupItem';
import { DocumentList } from './DocumentList';
import type { DocumentMeta, TagInfo } from '../types/document';

const UNCATEGORIZED_CONTAINER_ID = '__uncategorized__';

interface SidebarTagGroupsProps {
    sortedGroups: TagInfo[];
    filteredDocsByGroup: Map<string, DocumentMeta[]>;
    tagFilteredUngrouped: DocumentMeta[];
    activeDocId: string | null;
    activeExternalPath: string | null;
    isDragging: boolean;
    editingGroupName: string | null;
    hasQuery: boolean;
    onToggleCollapsed: (name: string) => Promise<void>;
    onRenameGroup: (oldName: string, newName: string) => Promise<void>;
    onDeleteGroup: (name: string) => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange: (name: string | null) => void;
    onAddDocumentToGroup: (groupName: string) => Promise<void>;
    onCreateGroup: () => void;
    onCreateDocument: () => void;
    strings: {
        LABELS: {
            GROUPS: string;
            DOCUMENTS: string;
        };
        TOOLTIPS: {
            NEW_GROUP: string;
            NEW_DOC: string;
        };
    };
}

/**
 * Renders the tag groups section and uncategorized documents in the sidebar.
 */
export function SidebarTagGroups({
    sortedGroups,
    filteredDocsByGroup,
    tagFilteredUngrouped,
    activeDocId,
    activeExternalPath,
    isDragging,
    editingGroupName,
    hasQuery,
    onToggleCollapsed,
    onRenameGroup,
    onDeleteGroup,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocumentToGroup,
    onCreateGroup,
    onCreateDocument,
    strings,
}: SidebarTagGroupsProps) {
    const { setNodeRef: setUncategorizedDroppableRef } = useDroppable({
        id: `doc-container:${UNCATEGORIZED_CONTAINER_ID}`,
        data: { type: 'doc-container', containerId: UNCATEGORIZED_CONTAINER_ID },
        disabled: hasQuery,
    });

    return (
        <>
            {/* Tag Groups Section */}
            {sortedGroups.length > 0 && (
                <div className="folders-section" role="tree" aria-label={strings.LABELS.GROUPS}>
                    <div className="section-label-row">
                        <span className="section-label">{strings.LABELS.GROUPS}</span>
                        <button
                            className="section-add-btn"
                            onClick={onCreateGroup}
                            title={strings.TOOLTIPS.NEW_GROUP}
                            aria-label={strings.TOOLTIPS.NEW_GROUP}
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
                                    activeDocId={activeExternalPath ? null : activeDocId}
                                    onToggle={onToggleCollapsed}
                                    onRename={onRenameGroup}
                                    onDelete={onDeleteGroup}
                                    onSelectDocument={onSelectDocument}
                                    onDeleteDocument={onDeleteDocument}
                                    onEditingChange={onEditingChange}
                                    onAddDocument={onAddDocumentToGroup}
                                />
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                </div>
            )}

            {/* Uncategorized Documents */}
            {tagFilteredUngrouped.length > 0 && (
                <motion.div
                    ref={setUncategorizedDroppableRef}
                    className="uncategorized-section"
                    layout={!isDragging ? 'position' : false}
                >
                    <div className="section-label-row docs-section-header">
                        {sortedGroups.length > 0 && <hr className="section-divider" />}
                        <button
                            className="section-add-btn"
                            onClick={onCreateDocument}
                            title={strings.TOOLTIPS.NEW_DOC}
                            aria-label={strings.TOOLTIPS.NEW_DOC}
                        >
                            <Plus size={14} aria-hidden="true" />
                        </button>
                    </div>
                    <ul
                        className="document-list"
                        role="listbox"
                        aria-label={strings.LABELS.DOCUMENTS}
                    >
                        <DocumentList
                            items={tagFilteredUngrouped}
                            activeId={activeExternalPath ? null : activeDocId}
                            isSearchMode={false}
                            onSelect={onSelectDocument}
                            onDelete={onDeleteDocument}
                            sortable={true}
                            containerId={UNCATEGORIZED_CONTAINER_ID}
                        />
                    </ul>
                </motion.div>
            )}
        </>
    );
}
