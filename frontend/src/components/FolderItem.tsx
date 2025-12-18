import { useState } from 'react';
import { Folder, DocumentMeta } from '../types/document';
import { ChevronRight, Folder as FolderIcon, FolderOpen, Pencil, Trash2, FileText } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface FolderItemProps {
    folder: Folder;
    documents: DocumentMeta[];
    activeDocId: string | null;
    onToggle: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onSelectDocument: (id: string) => void;
    onRenameDocument: (id: string, title: string) => void;
    onDeleteDocument: (id: string) => void;
    onMoveDocument: (docId: string, folderId: string) => void;
}

export function FolderItem({
    folder,
    documents,
    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onSelectDocument,
    onRenameDocument,
    onDeleteDocument,
    onMoveDocument,
}: FolderItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const [docEditingId, setDocEditingId] = useState<string | null>(null);
    const [docEditTitle, setDocEditTitle] = useState('');

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== folder.name) {
            onRename(editName.trim());
        }
        setIsEditing(false);
    };

    const startDocRename = (e: React.MouseEvent, doc: DocumentMeta) => {
        e.stopPropagation();
        setDocEditingId(doc.id);
        setDocEditTitle(doc.title);
    };

    const finishDocRename = () => {
        if (docEditingId && docEditTitle.trim()) {
            onRenameDocument(docEditingId, docEditTitle.trim());
        }
        setDocEditingId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const docId = e.dataTransfer.getData('text/plain');
        if (docId) {
            onMoveDocument(docId, folder.id);
        }
    };

    const handleDocDragStart = (e: React.DragEvent, docId: string) => {
        e.dataTransfer.setData('text/plain', docId);
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="folder-item">
            <div
                className="folder-header"
                onClick={onToggle}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
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
                    />
                ) : (
                    <span
                        className="folder-name"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditName(folder.name);
                            setIsEditing(true);
                        }}
                    >{folder.name}</span>
                )}
                <span className="folder-count">{documents.length}</span>
                <div className="folder-actions">
                    <button
                        className="action-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditName(folder.name);
                            setIsEditing(true);
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
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className={`document-item folder-doc ${doc.id === activeDocId ? 'active' : ''}`}
                            onClick={() => onSelectDocument(doc.id)}
                            draggable
                            onDragStart={(e) => handleDocDragStart(e, doc.id)}
                        >
                            {docEditingId === doc.id ? (
                                <input
                                    type="text"
                                    className="rename-input"
                                    value={docEditTitle}
                                    onChange={(e) => setDocEditTitle(e.target.value)}
                                    onBlur={finishDocRename}
                                    onKeyDown={(e) => e.key === 'Enter' && finishDocRename()}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <>
                                    <FileText size={16} className="doc-icon" />
                                    <span
                                        className="doc-title"
                                        onDoubleClick={(e) => startDocRename(e, doc)}
                                    >{doc.title}</span>
                                    <div className="doc-actions">
                                        <button
                                            className="action-btn"
                                            onClick={(e) => startDocRename(e, doc)}
                                            title={STRINGS.TOOLTIPS.RENAME}
                                        >
                                            <Pencil size={14} />
                                        </button>
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
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
