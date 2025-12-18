import { useState, useMemo, useRef } from 'react';
import { Folder, DocumentMeta } from '../types/document';
import { ChevronRight, Folder as FolderIcon, FolderOpen, Pencil, Trash2, FileText, Plus } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';

interface FolderItemProps {
    folder: Folder;
    documents: DocumentMeta[];
    activeDocId: string | null;
    onToggle: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onMoveDocument: (docId: string, folderId: string) => void;
    onReorderDocuments?: (ids: string[]) => void;
    onEditingChange?: (isEditing: boolean) => void;
    onAddDocument?: () => void;
}

export function FolderItem({
    folder,
    documents,
    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onSelectDocument,
    onDeleteDocument,
    onMoveDocument,
    onReorderDocuments,
    onEditingChange,
    onAddDocument,
}: FolderItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [headerDragOver, setHeaderDragOver] = useState(false);
    const draggedIdRef = useRef<string | null>(null);

    const sortedDocs = useMemo(() => {
        return [...documents].sort((a, b) => a.order - b.order);
    }, [documents]);

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

    // 文件夹头部拖拽处理（接收从其他地方拖来的文档）
    const handleHeaderDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setHeaderDragOver(true);
    };

    const handleHeaderDragLeave = () => {
        setHeaderDragOver(false);
    };

    const handleHeaderDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setHeaderDragOver(false);
        const docId = e.dataTransfer.getData('text/plain');
        if (docId) {
            onMoveDocument(docId, folder.id);
        }
    };

    // 文档拖拽开始
    const handleDocDragStart = (e: React.DragEvent, docId: string) => {
        draggedIdRef.current = docId;
        e.dataTransfer.setData('text/plain', docId);
        e.dataTransfer.effectAllowed = 'move';
    };

    // 文档拖拽悬停（用于排序）
    const handleDocDragOver = (e: React.DragEvent, docId: string) => {
        e.preventDefault();
        if (draggedIdRef.current && draggedIdRef.current !== docId) {
            setDragOverId(docId);
        }
    };

    const handleDocDragLeave = () => {
        setDragOverId(null);
    };

    // 文档放置（用于排序）
    const handleDocDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);

        const draggedId = draggedIdRef.current;
        draggedIdRef.current = null;

        if (!draggedId || !onReorderDocuments) return;

        // 检查是否是文件夹内的文档排序
        const currentIds = sortedDocs.map(d => d.id);
        const draggedIndex = currentIds.indexOf(draggedId);
        const targetIndex = currentIds.indexOf(targetId);

        if (draggedIndex !== -1 && targetIndex !== -1 && draggedId !== targetId) {
            // 文件夹内排序
            const newIds = [...currentIds];
            newIds.splice(draggedIndex, 1);
            newIds.splice(targetIndex, 0, draggedId);
            onReorderDocuments(newIds);
        } else if (draggedIndex === -1) {
            // 从外部拖入：移动到文件夹
            onMoveDocument(draggedId, folder.id);
        }
    };

    const handleDocDragEnd = () => {
        draggedIdRef.current = null;
        setDragOverId(null);
    };

    return (
        <div className="folder-item">
            <div
                className={`folder-header ${headerDragOver ? 'drag-over' : ''}`}
                onClick={onToggle}
                onDragOver={handleHeaderDragOver}
                onDragLeave={handleHeaderDragLeave}
                onDrop={handleHeaderDrop}
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
                        onDragStart={(e) => e.stopPropagation()}
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
                <span className="folder-count">{documents.length}</span>
                <div className="folder-actions">
                    {onAddDocument && (
                        <button
                            className="action-btn"
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
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        title={STRINGS.TOOLTIPS.FOLDER_DELETE}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className={`folder-documents ${folder.collapsed ? 'collapsed' : ''}`}>
                <div className="folder-documents-inner">
                    <AnimatePresence mode="popLayout">
                        {sortedDocs.map((doc) => (
                            <motion.div
                                key={doc.id}
                                layout
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                className={`document-item folder-doc ${doc.id === activeDocId ? 'active' : ''} ${dragOverId === doc.id ? 'drag-over-item' : ''}`}
                                onClick={() => onSelectDocument(doc.id)}
                                draggable
                                onDragStart={(e) => handleDocDragStart(e as unknown as React.DragEvent, doc.id)}
                                onDragOver={(e) => handleDocDragOver(e as unknown as React.DragEvent, doc.id)}
                                onDragLeave={handleDocDragLeave}
                                onDrop={(e) => handleDocDrop(e as unknown as React.DragEvent, doc.id)}
                                onDragEnd={handleDocDragEnd}
                            >
                                <FileText size={16} className="doc-icon" />
                                <span className="doc-title">{doc.title}</span>
                                <div className="doc-actions">
                                    <button
                                        className="action-btn danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteDocument(doc.id);
                                        }}
                                        title={STRINGS.TOOLTIPS.DELETE}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
