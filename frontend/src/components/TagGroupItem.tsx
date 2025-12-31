import { memo, useMemo, useState } from 'react';
import type { DocumentMeta, TagInfo } from '../types/document';
import { ChevronRight, Tag, Pencil, Trash2, Plus } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { useSettings } from '../contexts/SettingsContext';
import { AnimatePresence, motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { docDndId } from '../utils/dnd';
import { SortableDocItem } from './SortableDocItem';
import './TagGroupItem.css';

interface TagGroupItemProps {
    group: TagInfo;
    index: number;
    documents: DocumentMeta[];
    disabled: boolean;
    activeDocId: string | null;
    onToggle: (name: string) => void;
    onRename: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange?: (name: string | null) => void;
    onAddDocument?: (groupName: string) => void;
}

export const TagGroupItem = memo(function TagGroupItem({
    group,

    documents,

    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocument,
}: TagGroupItemProps) {
    const { language } = useSettings();
    const STRINGS = getStrings(language);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(group.name);

    const sortedDocs = useMemo(() => {
        return [...documents].sort((a, b) => a.order - b.order);
    }, [documents]);

    const isCollapsed = group.collapsed ?? false;

    // Droppable only on header to allow precise drop targeting
    // This prevents accidental selection of collapsed groups when dragging over them
    const {
        setNodeRef: setHeaderDroppableRef,
        isOver,
    } = useDroppable({
        id: `doc-container:${group.name}`,
        data: { type: 'doc-container', containerId: group.name, collapsed: isCollapsed },
    });

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== group.name) {
            onRename(group.name, editName.trim());
        }
        setIsEditing(false);
        onEditingChange?.(null);
    };

    const startEditing = () => {
        setEditName(group.name);
        setIsEditing(true);
        onEditingChange?.(group.name);
    };

    return (
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
                onClick={() => onToggle(group.name)}
                role="treeitem"
                aria-expanded={!isCollapsed}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle(group.name);
                    } else if (e.key === 'ArrowRight' && isCollapsed) {
                        e.preventDefault();
                        onToggle(group.name);
                    } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                        e.preventDefault();
                        onToggle(group.name);
                    }
                }}
            >
                <span className={`folder-chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                    <ChevronRight size={16} aria-hidden="true" />
                </span>
                <Tag size={16} className="folder-icon" aria-hidden="true" style={group.color ? { color: group.color } : undefined} />
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
                    >{group.name}</span>
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
                                    onAddDocument(group.name);
                                }}
                                title={STRINGS.TOOLTIPS.GROUP_ADD_DOC}
                                aria-label={STRINGS.TOOLTIPS.GROUP_ADD_DOC}
                            >
                                <Plus size={14} aria-hidden="true" />
                            </button>
                        )}
                        <button
                            className="action-btn"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                startEditing();
                            }}
                            title={STRINGS.TOOLTIPS.GROUP_RENAME}
                            aria-label={STRINGS.TOOLTIPS.GROUP_RENAME}
                        >
                            <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                            className="action-btn danger"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(group.name);
                            }}
                            title={STRINGS.TOOLTIPS.GROUP_DELETE}
                            aria-label={STRINGS.TOOLTIPS.GROUP_DELETE}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
            <div
                className={`folder-documents ${isCollapsed ? 'collapsed' : ''}`}
                role="group"
                aria-label={`${group.name} 中的文档`}
            >
                <div className="folder-documents-inner">
                    <SortableContext items={sortedDocs.map(d => docDndId(d.id))} strategy={verticalListSortingStrategy}>
                        <AnimatePresence mode="popLayout">
                            {sortedDocs.map((doc, index) => (
                                <SortableDocItem
                                    key={doc.id}
                                    item={doc}
                                    index={index}
                                    containerId={group.name}
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
    );
});
