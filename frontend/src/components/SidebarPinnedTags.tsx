import { ArrowUpDown, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PinnedTagItem } from './PinnedTagItem';
import { DocumentList } from './DocumentList';
import type { DocumentMeta, TagInfo } from '../types/document';
import type { DocDropIndicator, PinnedTagDropIndicator } from '../types/dnd';
import { DND_CONSTANTS } from '../constants/strings';

const { UNCATEGORIZED_CONTAINER_ID, DOC_CONTAINER_LIST_PREFIX, PINNED_TAG_PREFIX } = DND_CONSTANTS;


interface SidebarPinnedTagsProps {
    pinnedTags: TagInfo[];
    filteredDocsByTag: Map<string, DocumentMeta[]>;
    tagFilteredUngrouped: DocumentMeta[];
    activeDocId: string | null;
    activeExternalPath: string | null;
    isDragging: boolean;
    editingTagName: string | null;
    hasQuery: boolean;
    isReorderMode: boolean;
    onToggleReorderMode: () => void;
    docDropIndicator: DocDropIndicator | null;
    pinnedTagDropIndicator: PinnedTagDropIndicator | null;
    onToggleCollapsed: (name: string) => Promise<void>;
    onRenameTag: (oldName: string, newName: string) => Promise<void>;
    onDeleteTag: (name: string) => void;
    onUnpinTag?: (name: string) => void;
    onColorSelect?: (tagName: string, color: string) => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange: (name: string | null) => void;
    onAddDocumentToTag: (tagName: string) => Promise<void>;
    onCreatePinnedTag: () => void;
    onCreateDocument: () => void;
    strings: {
        LABELS: {
            PINNED_TAGS: string;
            DOCUMENTS: string;
        };
        TOOLTIPS: {
            NEW_PINNED_TAG: string;
            REORDER_PINNED_TAGS: string;
            REORDER_PINNED_TAGS_DONE: string;
            NEW_DOC: string;
        };
    };
}

/**
 * Renders the pinned tags section and uncategorized documents in the sidebar.
 */
export function SidebarPinnedTags({
    pinnedTags,
    filteredDocsByTag,
    tagFilteredUngrouped,
    activeDocId,
    activeExternalPath,
    isDragging,
    editingTagName,
    hasQuery,
    isReorderMode,
    onToggleReorderMode,
    docDropIndicator,
    pinnedTagDropIndicator,
    onToggleCollapsed,
    onRenameTag,
    onDeleteTag,
    onUnpinTag,
    onColorSelect,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocumentToTag,
    onCreatePinnedTag,
    onCreateDocument,
    strings,
}: SidebarPinnedTagsProps) {
    const { setNodeRef: setUncategorizedDroppableRef } = useDroppable({
        id: `${DOC_CONTAINER_LIST_PREFIX}${UNCATEGORIZED_CONTAINER_ID}`,
        data: { type: 'doc-container', containerId: UNCATEGORIZED_CONTAINER_ID, role: 'list' },
        disabled: hasQuery,
    });

    const showReorderToggle = pinnedTags.length > 1;
    const reorderTooltip = isReorderMode
        ? strings.TOOLTIPS.REORDER_PINNED_TAGS_DONE
        : strings.TOOLTIPS.REORDER_PINNED_TAGS;

    return (
        <>
            {/* Pinned Tags Section */}
            {pinnedTags.length > 0 && (
                <div className="folders-section" role="tree" aria-label={strings.LABELS.PINNED_TAGS}>
                    <div className="section-label-row">
                        <span className="section-label">{strings.LABELS.PINNED_TAGS}</span>
                        <div className="section-actions">
                            {showReorderToggle && (
                                <button
                                    className={`section-add-btn ${isReorderMode ? 'active' : ''}`}
                                    onClick={onToggleReorderMode}
                                    title={reorderTooltip}
                                    aria-label={reorderTooltip}
                                    aria-pressed={isReorderMode}
                                >
                                    <ArrowUpDown size={14} aria-hidden="true" />
                                </button>
                            )}
                            <button
                                className="section-add-btn"
                                onClick={onCreatePinnedTag}
                                title={strings.TOOLTIPS.NEW_PINNED_TAG}
                                aria-label={strings.TOOLTIPS.NEW_PINNED_TAG}
                            >
                                <Plus size={14} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <SortableContext
                        items={pinnedTags.map(t => `${PINNED_TAG_PREFIX}${t.name}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <AnimatePresence mode="popLayout">
                            {pinnedTags.map((tag, index) => (
                                <PinnedTagItem
                                    key={tag.name}
                                    tag={tag}
                                    index={index}
                                    documents={filteredDocsByTag.get(tag.name) || []}
                                    disabled={editingTagName === tag.name}
                                    isReorderMode={isReorderMode}
                                    docDropIndicator={docDropIndicator}
                                    pinnedTagDropIndicator={pinnedTagDropIndicator}
                                    activeDocId={activeExternalPath ? null : activeDocId}
                                    onToggle={onToggleCollapsed}
                                    onRename={onRenameTag}
                                    onDelete={onDeleteTag}
                                    onUnpin={onUnpinTag}
                                    onColorSelect={onColorSelect}
                                    onSelectDocument={onSelectDocument}
                                    onDeleteDocument={onDeleteDocument}
                                    onEditingChange={onEditingChange}
                                    onAddDocument={onAddDocumentToTag}
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
                        {pinnedTags.length > 0 && <hr className="section-divider" />}
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
                            dropIndicator={docDropIndicator}
                        />
                    </ul>
                </motion.div>
            )}
        </>
    );
}
