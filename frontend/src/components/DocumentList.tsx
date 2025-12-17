import { useState } from 'react';
import { DocumentMeta, SearchResult } from '../types/document';
import { FileText, Pencil, Trash2, FileSearch } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface DocumentListProps {
    items: (DocumentMeta | SearchResult)[];
    activeId: string | null;
    isSearchMode: boolean;
    onSelect: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
}

export function DocumentList({
    items,
    activeId,
    isSearchMode,
    onSelect,
    onRename,
    onDelete,
}: DocumentListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const startRename = (e: React.MouseEvent, doc: DocumentMeta | SearchResult) => {
        e.stopPropagation();
        setEditingId(doc.id);
        setEditTitle(doc.title);
    };

    const finishRename = () => {
        if (editingId && editTitle.trim()) {
            onRename(editingId, editTitle.trim());
        }
        setEditingId(null);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onDelete(id);
    };

    if (items.length === 0) {
        return (
            <li className="empty-hint">
                <FileSearch size={32} strokeWidth={1.5} />
                <span>{isSearchMode ? STRINGS.LABELS.NO_MATCH : STRINGS.LABELS.EMPTY_LIST}</span>
            </li>
        );
    }

    return (
        <>
            {items.map((item) => (
                <li
                    key={item.id}
                    className={`document-item ${item.id === activeId ? 'active' : ''}`}
                    onClick={() => onSelect(item.id)}
                >
                    {editingId === item.id ? (
                        <input
                            type="text"
                            className="rename-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={finishRename}
                            onKeyDown={(e) => e.key === 'Enter' && finishRename()}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <>
                            <FileText size={16} className="doc-icon" />
                            <div className="doc-content">
                                <span className="doc-title">{item.title}</span>
                                {'snippet' in item && (
                                    <span className="doc-snippet">{item.snippet}</span>
                                )}
                            </div>
                            <div className="doc-actions">
                                <button
                                    className="action-btn"
                                    onClick={(e) => startRename(e, item)}
                                    title={STRINGS.TOOLTIPS.RENAME}
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    className="action-btn danger"
                                    onClick={(e) => handleDeleteClick(e, item.id)}
                                    title={STRINGS.TOOLTIPS.DELETE}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </>
                    )}
                </li>
            ))}
        </>
    );
}
