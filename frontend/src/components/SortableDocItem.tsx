import { memo, useEffect, useRef } from 'react';
import { DocumentMeta, SearchResult } from '../types/document';
import type { DocDropIndicator } from '../types/dnd';
import { FileText, Trash2 } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { docDndId } from '../utils/dnd';
import { listItemVariants } from '../utils/animations';

export interface SortableDocItemProps {
    item: DocumentMeta | SearchResult;
    index: number;
    containerId: string;
    activeId: string | null;
    dropIndicator?: DocDropIndicator | null;
    justDroppedId?: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    /** 是否在文件夹内显示（样式略有不同） */
    inFolder?: boolean;
    /** 是否显示 snippet (搜索结果模式) */
    showSnippet?: boolean;
}

/**
 * 通用可排序文档项组件
 * 统一了 DocumentList 和 FolderItem 中的重复实现
 */
export const SortableDocItem = memo(function SortableDocItem({
    item,
    index,
    containerId,
    activeId,
    dropIndicator,
    justDroppedId,
    onSelect,
    onDelete,
    inFolder = false,
    showSnippet = false,
}: SortableDocItemProps) {
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
    const isActive = item.id === activeId;
    const hasSnippet = showSnippet && 'snippet' in item;

    const hasAnimatedInRef = useRef(false);
    useEffect(() => {
        hasAnimatedInRef.current = true;
    }, []);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(item.id);
    };

    const baseClassName = inFolder ? 'document-item folder-doc sortable' : 'document-item sortable';
    const className = `${baseClassName} ${isActive ? 'active' : ''} ${isDragging ? 'is-dragging' : ''} ${dropClass} ${isJustDropped ? 'just-dropped' : ''}`;

    // 文件夹内的文档使用 div，外部使用 li
    const MotionComponent = inFolder ? motion.div : motion.li;

    return (
        <MotionComponent
            ref={setNodeRef}
            style={style}
            layout={!isDragging}
            variants={listItemVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={{ index, isActive, staggerIndex: hasAnimatedInRef.current ? 0 : index }}
            className={className}
            onClick={() => onSelect(item.id)}
            {...attributes}
            {...listeners}
        >
            <FileText size={16} className="doc-icon" />
            {hasSnippet ? (
                <div className="doc-content">
                    <span className="doc-title">{item.title}</span>
                    <span className="doc-snippet">{(item as SearchResult).snippet}</span>
                </div>
            ) : (
                <span className="doc-title">{item.title}</span>
            )}
            <div className="doc-actions">
                <button
                    className="action-btn danger"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleDelete}
                    title={STRINGS.TOOLTIPS.DELETE}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </MotionComponent>
    );
});
