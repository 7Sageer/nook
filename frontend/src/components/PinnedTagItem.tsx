import { memo, useMemo, useState, useCallback } from 'react';
import type { DocumentMeta, TagInfo } from '../types/document';
import { ChevronRight, Tag, Plus, MoreHorizontal } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { useSettings } from '../contexts/SettingsContext';
import { TagContextMenu } from './TagContextMenu';
import { AnimatePresence, motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { docInstanceDndId } from '../utils/dnd';
import { SortableDocItem } from './SortableDocItem';
import './PinnedTagItem.css';

interface PinnedTagItemProps {
    tag: TagInfo;
    index: number;
    documents: DocumentMeta[];
    disabled: boolean;
    activeDocId: string | null;
    onToggle: (name: string) => void;
    onRename: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
    onUnpin?: (name: string) => void;
    onColorSelect?: (tagName: string, color: string) => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange?: (name: string | null) => void;
    onAddDocument?: (tagName: string) => void;
}

export const PinnedTagItem = memo(function PinnedTagItem({
    tag,

    documents,

    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onUnpin,
    onColorSelect,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocument,
}: PinnedTagItemProps) {
    const { language } = useSettings();
    const STRINGS = getStrings(language);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag.name);
    const [contextMenu, setContextMenu] = useState<{
        position: { x: number; y: number };
    } | null>(null);

    const sortedDocs = useMemo(() => {
        return [...documents].sort((a, b) => a.order - b.order);
    }, [documents]);

    const isCollapsed = tag.collapsed ?? false;

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            position: { x: e.clientX, y: e.clientY },
        });
    }, []);

    const handleMoreClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({
            position: { x: rect.right + 4, y: rect.top },
        });
    }, []);

    const handleColorSelect = useCallback((name: string, color: string) => {
        onColorSelect?.(name, color);
    }, [onColorSelect]);

    const handleUnpin = useCallback(() => {
        onUnpin?.(tag.name);
    }, [onUnpin, tag.name]);

    const handleDelete = useCallback(() => {
        onDelete(tag.name);
    }, [onDelete, tag.name]);

    // Droppable only on header to allow precise drop targeting
    const {
        setNodeRef: setHeaderDroppableRef,
        isOver,
    } = useDroppable({
        id: `doc-container:${tag.name}`,
        data: { type: 'doc-container', containerId: tag.name, collapsed: isCollapsed },
    });

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== tag.name) {
            onRename(tag.name, editName.trim());
        }
        setIsEditing(false);
        onEditingChange?.(null);
    };

    const startEditing = () => {
        setEditName(tag.name);
        setIsEditing(true);
        onEditingChange?.(tag.name);
    };

    return (
        <>
            <motion.div
                className={`folder-item ${isOver ? 'drop-target' : ''}`}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
            >
                <div
                    ref={setHeaderDroppableRef}
                    className="folder-header"
                    onClick={() => onToggle(tag.name)}
                    onContextMenu={handleContextMenu}
                    role="treeitem"
                    aria-expanded={!isCollapsed}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle(tag.name);
                        } else if (e.key === 'ArrowRight' && isCollapsed) {
                            e.preventDefault();
                            onToggle(tag.name);
                        } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                            e.preventDefault();
                            onToggle(tag.name);
                        }
                    }}
                >
                    <span className={`folder-chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                        <ChevronRight size={16} aria-hidden="true" />
                    </span>
                    <Tag size={16} className="folder-icon" aria-hidden="true" style={tag.color ? { color: tag.color } : undefined} />
                    {isEditing ? (
                        <input
                            type="text"
                            className="folder-rename-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="folder-name"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEditing();
                            }}
                        >{tag.name}</span>
                    )}
                    {!isEditing && (
                        <span className="folder-count">{documents.length}</span>
                    )}
                    {!isEditing && (
                        <div className="folder-actions">
                            {onAddDocument && (
                                <button
                                    className="action-btn"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddDocument(tag.name);
                                    }}
                                    title={STRINGS.TOOLTIPS.PINNED_TAG_ADD_DOC}
                                    aria-label={STRINGS.TOOLTIPS.PINNED_TAG_ADD_DOC}
                                >
                                    <Plus size={14} aria-hidden="true" />
                                </button>
                            )}
                            <button
                                className="action-btn"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleMoreClick}
                                title={STRINGS.TOOLTIPS.PINNED_TAG_RENAME} // Reuse a generic tooltip or update later
                                aria-label="More options"
                            >
                                <MoreHorizontal size={14} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>
                <div
                    className={`folder-documents ${isCollapsed ? 'collapsed' : ''}`}
                    role="group"
                    aria-label={`${tag.name} 中的文档`}
                >
                    <div className="folder-documents-inner">
                        <SortableContext items={sortedDocs.map(d => docInstanceDndId(tag.name, d.id))} strategy={verticalListSortingStrategy}>
                            <AnimatePresence mode="popLayout">
                                {sortedDocs.map((doc, index) => (
                                    <SortableDocItem
                                        key={doc.id}
                                        item={doc}
                                        index={index}
                                        containerId={tag.name}
                                        activeId={activeDocId}
                                        onSelect={onSelectDocument}
                                        onDelete={onDeleteDocument}
                                        inFolder
                                        hidden={isCollapsed}
                                    />
                                ))}
                            </AnimatePresence>
                        </SortableContext>
                    </div>
                </div>
            </motion.div>
            {contextMenu && (
                <TagContextMenu
                    tagName={tag.name}
                    currentColor={tag.color}
                    isPinned={true}
                    position={contextMenu.position}
                    onPin={() => { }} // Already pinned
                    onUnpin={handleUnpin}
                    onColorSelect={handleColorSelect}
                    onRename={startEditing}
                    onDelete={handleDelete}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
});
