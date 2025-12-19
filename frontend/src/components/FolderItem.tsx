import { memo, useMemo, useState } from 'react';
import { Folder, DocumentMeta } from '../types/document';
import { ChevronRight, Folder as FolderIcon, FolderOpen, Pencil, Trash2, FileText, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { docContainerDndId, docDndId } from '../utils/dnd';

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
    dropIndicator?: { docId: string; position: 'before' | 'after' } | null;
    containerDropIndicator?: { containerId: string } | null;
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
                        {sortedDocs.map((doc) => (
                            <SortableFolderDocRow
                                key={doc.id}
                                doc={doc}
                                containerId={folder.id}
                                activeDocId={activeDocId}
                                dropIndicator={dropIndicator}
                                onSelectDocument={onSelectDocument}
                                onDeleteDocument={onDeleteDocument}
                            />
                        ))}
                    </SortableContext>
                </div>
            </div>
        </div>
    );
});

function SortableFolderDocRow({
    doc,
    containerId,
    activeDocId,
    dropIndicator,
    onSelectDocument,
    onDeleteDocument,
}: {
    doc: DocumentMeta;
    containerId: string;
    activeDocId: string | null;
    dropIndicator?: { docId: string; position: 'before' | 'after' } | null;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: docDndId(doc.id),
        data: { type: 'document', containerId, docId: doc.id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
        transition,
    };

    const dropClass =
        dropIndicator?.docId === doc.id
            ? dropIndicator.position === 'before'
                ? 'drop-before'
                : 'drop-after'
            : '';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`document-item folder-doc sortable ${doc.id === activeDocId ? 'active' : ''} ${isDragging ? 'is-dragging' : ''} ${dropClass}`}
            onClick={() => onSelectDocument(doc.id)}
            {...attributes}
            {...listeners}
        >
            <FileText size={16} className="doc-icon" />
            <span className="doc-title">{doc.title}</span>
            <div className="doc-actions">
                <button
                    className="action-btn danger"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDocument(doc.id);
                    }}
                    title={STRINGS.TOOLTIPS.DELETE}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}
