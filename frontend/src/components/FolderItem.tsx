import { memo, useMemo, useState } from 'react';
import { Folder, DocumentMeta } from '../types/document';
import type { DocDropIndicator, ContainerDropIndicator } from '../types/dnd';
import { ChevronRight, Folder as FolderIcon, FolderOpen, Pencil, Trash2, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { docContainerDndId, docDndId } from '../utils/dnd';
import { SortableDocItem } from './SortableDocItem';

interface FolderItemProps {
    folder: Folder;
    documents: DocumentMeta[];
    activeDocId: string | null;
    onToggle: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange?: (isEditing: boolean) => void;
    onAddDocument?: () => void;
    folderDragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
    dropIndicator?: DocDropIndicator | null;
    containerDropIndicator?: ContainerDropIndicator | null;
    justDroppedId?: string | null;
    onAddTag?: (docId: string, tag: string) => void;
    onRemoveTag?: (docId: string, tag: string) => void;
    onTagClick?: (tag: string) => void;
}

export const FolderItem = memo(function FolderItem({
    folder,
    documents,
    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocument,
    folderDragHandleProps,
    dropIndicator,
    containerDropIndicator,
    justDroppedId,
    onAddTag,
    onRemoveTag,
    onTagClick,
}: FolderItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);

    const sortedDocs = useMemo(() => {
        return [...documents].sort((a, b) => a.order - b.order);
    }, [documents]);

    const {
        setNodeRef: setHeaderDroppableRef,
    } = useDroppable({
        id: docContainerDndId(folder.id),
        data: { type: 'doc-container', containerId: folder.id },
    });

    const isContainerDropTarget = containerDropIndicator?.containerId === folder.id;

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== folder.name) {
            onRename(editName.trim());
        }
        setIsEditing(false);
        onEditingChange?.(false);
    };

    const startEditing = () => {
        setEditName(folder.name);
        setIsEditing(true);
        onEditingChange?.(true);
    };

    return (
        <div className="folder-item">
            <div
                ref={setHeaderDroppableRef}
                className={`folder-header ${isContainerDropTarget ? 'drop-target' : ''}`}
                onClick={onToggle}
                role="treeitem"
                aria-expanded={!folder.collapsed}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle();
                    } else if (e.key === 'ArrowRight' && folder.collapsed) {
                        e.preventDefault();
                        onToggle();
                    } else if (e.key === 'ArrowLeft' && !folder.collapsed) {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                {...folderDragHandleProps}
            >
                <span className={`folder-chevron ${folder.collapsed ? 'collapsed' : 'expanded'}`}>
                    <ChevronRight size={16} aria-hidden="true" />
                </span>
                {folder.collapsed ? (
                    <FolderIcon size={16} className="folder-icon" aria-hidden="true" />
                ) : (
                    <FolderOpen size={16} className="folder-icon" aria-hidden="true" />
                )}
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
                    >{folder.name}</span>
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
                                    onAddDocument();
                                }}
                                title={STRINGS.TOOLTIPS.FOLDER_ADD_DOC}
                                aria-label={STRINGS.TOOLTIPS.FOLDER_ADD_DOC}
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
                            title={STRINGS.TOOLTIPS.FOLDER_RENAME}
                            aria-label={STRINGS.TOOLTIPS.FOLDER_RENAME}
                        >
                            <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                            className="action-btn danger"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            title={STRINGS.TOOLTIPS.FOLDER_DELETE}
                            aria-label={STRINGS.TOOLTIPS.FOLDER_DELETE}
                        >
                            <Trash2 size={14} aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
            <div
                className={`folder-documents ${folder.collapsed ? 'collapsed' : ''}`}
                role="group"
                aria-label={`${folder.name} 中的文档`}
            >
                <div className="folder-documents-inner">
                    <SortableContext items={sortedDocs.map((doc) => docDndId(doc.id))} strategy={verticalListSortingStrategy}>
                        <AnimatePresence mode="popLayout">
                            {sortedDocs.map((doc, index) => (
                                <SortableDocItem
                                    key={doc.id}
                                    item={doc}
                                    index={index}
                                    containerId={folder.id}
                                    activeId={activeDocId}
                                    dropIndicator={dropIndicator}
                                    justDroppedId={justDroppedId}
                                    onSelect={onSelectDocument}
                                    onDelete={onDeleteDocument}
                                    inFolder
                                    hidden={folder.collapsed}
                                    onAddTag={onAddTag}
                                    onRemoveTag={onRemoveTag}
                                    onTagClick={onTagClick}
                                />
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                </div>
            </div>
        </div>
    );
});

