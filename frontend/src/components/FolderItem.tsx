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
                {...folderDragHandleProps}
            >
                <span className={`folder-chevron ${folder.collapsed ? 'collapsed' : 'expanded'}`}>
                    <ChevronRight size={16} />
                </span>
                {folder.collapsed ? (
                    <FolderIcon size={16} className="folder-icon" />
                ) : (
                    <FolderOpen size={16} className="folder-icon" />
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
                            >
                                <Plus size={14} />
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
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            className="action-btn danger"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            title={STRINGS.TOOLTIPS.FOLDER_DELETE}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>
            <div className={`folder-documents ${folder.collapsed ? 'collapsed' : ''}`}>
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
                                />
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                </div>
            </div>
        </div>
    );
});

