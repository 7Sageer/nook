import { useMemo } from 'react';
import { DocumentMeta, SearchResult } from '../../types/document';
import type { DocDropIndicator } from '../../types/dnd';
import { FileText, Trash2, FileSearch } from 'lucide-react';
import { STRINGS } from '../../constants/strings';
import { motion, AnimatePresence } from 'framer-motion';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { docInstanceDndId } from '../../utils/dnd';
import { listItemVariants } from '../../utils/animations';
import { SortableDocItem } from './SortableDocItem';
import { SearchResultItem } from './SearchResultItem';

interface DocumentListProps {
    items: (DocumentMeta | SearchResult)[];
    activeId: string | null;
    isSearchMode: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    sortable?: boolean;
    containerId?: string;
    dropIndicator?: DocDropIndicator | null;
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
            <li className="empty-hint" role="status" aria-live="polite">
                <FileSearch size={32} strokeWidth={1.5} aria-hidden="true" />
                <span>{isSearchMode ? STRINGS.LABELS.NO_MATCH : STRINGS.LABELS.EMPTY_LIST}</span>
            </li>
        );
    }

    if (sortable) {
        if (!containerId) {
            throw new Error('DocumentList: containerId is required when sortable=true');
        }
        const sortableItems = sortedItems.map((item) => docInstanceDndId(containerId, item.id));
        return (
            <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                <AnimatePresence mode="popLayout">
                    {sortedItems.map((item, index) => (
                        <SortableDocItem
                            key={item.id}
                            item={item}
                            index={index}
                            containerId={containerId}
                            activeId={activeId}
                            dropIndicator={dropIndicator}
                            justDroppedId={justDroppedId}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            showSnippet={isSearchMode && 'snippet' in item}
                        />
                    ))}
                </AnimatePresence>
            </SortableContext>
        );
    }

    // Non-sortable mode (Search Results or Read-only list)
    return (
        <AnimatePresence mode="popLayout">
            {sortedItems.map((item, index) => (
                isSearchMode ? (
                    <SearchResultItem
                        key={item.id}
                        index={index}
                        title={item.title}
                        snippet={'snippet' in item ? item.snippet : undefined}
                        icon={<FileText size={16} className="doc-icon" aria-hidden="true" />}
                        isActive={item.id === activeId}
                        variant="document"
                        onClick={() => onSelect(item.id)}
                        onDelete={(e) => handleDeleteClick(e, item.id)}
                    />
                ) : (
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
                        role="option"
                        aria-selected={item.id === activeId}
                        tabIndex={0}
                    >
                        <FileText size={16} className="doc-icon" aria-hidden="true" />
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
                                aria-label={`${STRINGS.TOOLTIPS.DELETE} ${item.title}`}
                            >
                                <Trash2 size={14} aria-hidden="true" />
                            </button>
                        </div>
                    </motion.li>
                )
            ))}
        </AnimatePresence>
    );
}
