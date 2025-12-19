import { useMemo } from 'react';
import { DocumentMeta, SearchResult } from '../types/document';
import { FileText, Trash2, FileSearch } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { docDndId } from '../utils/dnd';
import { listItemVariants } from '../utils/animations';

interface DocumentListProps {
    items: (DocumentMeta | SearchResult)[];
    activeId: string | null;
    isSearchMode: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    sortable?: boolean;
    containerId?: string;
    dropIndicator?: { docId: string; position: 'before' | 'after' } | null;
    justDroppedId?: string | null;
}

export function DocumentList({
    items,
    activeId,
    isSearchMode,
    onSelect,
    onDelete,
    sortable = false,
    containerId,
    dropIndicator,
    justDroppedId,
}: DocumentListProps) {
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

    if (items.length === 0) {
        return (
            <li className="empty-hint">
                <FileSearch size={32} strokeWidth={1.5} />
                <span>{isSearchMode ? STRINGS.LABELS.NO_MATCH : STRINGS.LABELS.EMPTY_LIST}</span>
            </li>
        );
    }

    if (sortable) {
        if (!containerId) {
            throw new Error('DocumentList: containerId is required when sortable=true');
        }
        const sortableItems = sortedItems.map((item) => docDndId(item.id));
        return (
            <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                <AnimatePresence mode="popLayout">
                    {sortedItems.map((item, index) => (
                        <SortableDocumentRow
                            key={item.id}
                            item={item}
                            index={index}
                            activeId={activeId}
                            containerId={containerId}
                            dropIndicator={dropIndicator}
                            justDroppedId={justDroppedId}
                            onSelect={onSelect}
                            onDelete={handleDeleteClick}
                        />
                    ))}
                </AnimatePresence>
            </SortableContext>
        );
    }

    return (
        <AnimatePresence mode="popLayout">
            {sortedItems.map((item, index) => (
                <motion.li
                    key={item.id}
                    layout
                    variants={listItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    custom={index}
                    className={`document-item ${item.id === activeId ? 'active' : ''}`}
                    onClick={() => onSelect(item.id)}
                >
                    <FileText size={16} className="doc-icon" />
                    <div className="doc-content">
                        <span className="doc-title">{item.title}</span>
                        {'snippet' in item && <span className="doc-snippet">{item.snippet}</span>}
                    </div>
                    <div className="doc-actions">
                        <button
                            className="action-btn danger"
                            onPointerDown={(e) => e.stopPropagation()}
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

function SortableDocumentRow({
    item,
    index,
    activeId,
    containerId,
    dropIndicator,
    justDroppedId,
    onSelect,
    onDelete,
}: {
    item: DocumentMeta | SearchResult;
    index: number;
    activeId: string | null;
    containerId: string;
    dropIndicator?: { docId: string; position: 'before' | 'after' } | null;
    justDroppedId?: string | null;
    onSelect: (id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: docDndId(item.id),
        data: { type: 'document', containerId, docId: item.id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform ? { ...transform, x: 0 } : null),
        transition,
    };

    const dropClass =
        dropIndicator?.docId === item.id
            ? dropIndicator.position === 'before'
                ? 'drop-before'
                : 'drop-after'
            : '';

    const isJustDropped = justDroppedId === item.id;

    return (
        <motion.li
            ref={setNodeRef}
            style={style}
            // 拖拽时禁用 layout 动画，避免与 dnd-kit transform 冲突
            layout={!isDragging}
            variants={listItemVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={index}
            className={`document-item sortable ${item.id === activeId ? 'active' : ''} ${isDragging ? 'is-dragging' : ''} ${dropClass} ${isJustDropped ? 'just-dropped' : ''}`}
            onClick={() => onSelect(item.id)}
            {...attributes}
            {...listeners}
        >
            <FileText size={16} className="doc-icon" />
            <div className="doc-content">
                <span className="doc-title">{item.title}</span>
                {'snippet' in item && <span className="doc-snippet">{item.snippet}</span>}
            </div>
            <div className="doc-actions">
                <button
                    className="action-btn danger"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => onDelete(e, item.id)}
                    title={STRINGS.TOOLTIPS.DELETE}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </motion.li>
    );
}
