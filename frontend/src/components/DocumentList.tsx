import { useState, useMemo, useRef } from 'react';
import { DocumentMeta, SearchResult } from '../types/document';
import { FileText, Trash2, FileSearch } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentListProps {
    items: (DocumentMeta | SearchResult)[];
    activeId: string | null;
    isSearchMode: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    draggable?: boolean;
    onReorder?: (ids: string[]) => void;
}

export function DocumentList({
    items,
    activeId,
    isSearchMode,
    onSelect,
    onDelete,
    draggable = false,
    onReorder,
}: DocumentListProps) {
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const draggedIdRef = useRef<string | null>(null);

    const sortedItems = useMemo(() => {
        if (isSearchMode) return items;
        return [...items].sort((a, b) => {
            const orderA = 'order' in a ? a.order : 0;
            const orderB = 'order' in b ? b.order : 0;
            return orderA - orderB;
        });
    }, [items, isSearchMode]);

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onDelete(id);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        draggedIdRef.current = id;
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (draggedIdRef.current && draggedIdRef.current !== id) {
            setDragOverId(id);
        }
    };

    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDragOverId(null);
        const draggedId = draggedIdRef.current;
        draggedIdRef.current = null;

        if (!draggedId || draggedId === targetId || !onReorder) return;

        // 计算新顺序
        const currentIds = sortedItems.map(item => item.id);
        const draggedIndex = currentIds.indexOf(draggedId);
        const targetIndex = currentIds.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // 移动元素
        const newIds = [...currentIds];
        newIds.splice(draggedIndex, 1);
        newIds.splice(targetIndex, 0, draggedId);

        onReorder(newIds);
    };

    const handleDragEnd = () => {
        draggedIdRef.current = null;
        setDragOverId(null);
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
        <AnimatePresence mode="popLayout">
            {sortedItems.map((item) => (
                <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className={`document-item ${item.id === activeId ? 'active' : ''} ${dragOverId === item.id ? 'drag-over-item' : ''}`}
                    onClick={() => onSelect(item.id)}
                    draggable={draggable}
                    onDragStart={draggable ? (e) => handleDragStart(e as unknown as React.DragEvent, item.id) : undefined}
                    onDragOver={draggable ? (e) => handleDragOver(e as unknown as React.DragEvent, item.id) : undefined}
                    onDragLeave={draggable ? handleDragLeave : undefined}
                    onDrop={draggable ? (e) => handleDrop(e as unknown as React.DragEvent, item.id) : undefined}
                    onDragEnd={draggable ? handleDragEnd : undefined}
                >
                    <FileText size={16} className="doc-icon" />
                    <div className="doc-content">
                        <span className="doc-title">{item.title}</span>
                        {'snippet' in item && (
                            <span className="doc-snippet">{item.snippet}</span>
                        )}
                    </div>
                    <div className="doc-actions">
                        <button
                            className="action-btn danger"
                            onClick={(e) => handleDeleteClick(e, item.id)}
                            title={STRINGS.TOOLTIPS.DELETE}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </motion.li>
            ))}
        </AnimatePresence>
    );
}
