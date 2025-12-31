
import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { listItemVariants, durations, easings } from '../utils/animations';
import type { ChunkMatch } from '../types/document';

interface SearchResultItemProps {
    title: string;
    snippet?: string;
    icon?: ReactNode;
    matchCount?: number;
    isActive: boolean;
    variant?: 'semantic' | 'document';
    onClick: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    onChunkClick?: (blockId: string) => void;
    allChunks?: ChunkMatch[];
    index: number;
}

// Simpler animation for semantic items - no fixed height
const semanticItemVariants = {
    initial: { opacity: 0, x: -12 },
    animate: ({ index }: { index: number }) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: index * durations.stagger,
            duration: durations.normal,
            ease: easings.standard,
        },
    }),
    exit: {
        opacity: 0,
        x: -12,
        transition: { duration: durations.fast },
    },
};

const chunkListVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
        opacity: 1,
        height: 'auto',
        transition: { duration: durations.normal, ease: easings.standard }
    },
    exit: {
        opacity: 0,
        height: 0,
        transition: { duration: durations.fast }
    },
};

export function SearchResultItem({
    title,
    snippet,
    icon,
    matchCount,
    isActive,
    variant = 'document',
    onClick,
    onDelete,
    onChunkClick,
    allChunks,
    index,
}: SearchResultItemProps) {
    const isSemantic = variant === 'semantic';
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMultipleChunks = allChunks && allChunks.length > 1;

    // Base classes
    const containerClass = isSemantic
        ? `document-item semantic-item ${isActive ? 'active' : ''}`
        : `document-item ${isActive ? 'active' : ''}`;

    // Use different variants based on item type
    const variants = isSemantic ? semanticItemVariants : listItemVariants;

    const handleExpandClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleChunkClick = (e: React.MouseEvent, blockId: string) => {
        e.stopPropagation();
        onChunkClick?.(blockId);
    };

    return (
        <motion.li
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={containerClass}
            onClick={onClick}
            role="option"
            aria-selected={isActive}
            tabIndex={0}
            custom={{ index, isActive }}
        >
            {/* Icon - Only for document variant typically, or if provided */}
            {icon && <div className="doc-icon">{icon}</div>}

            <div className="doc-content">
                {isSemantic ? (
                    // Semantic Variant: Small Title + Content Snippet
                    <>
                        <span className="semantic-doc-title">{title}</span>
                        <span className="semantic-snippet">{snippet}</span>
                        {hasMultipleChunks && (
                            <button
                                className="semantic-expand-btn"
                                onClick={handleExpandClick}
                                aria-expanded={isExpanded}
                            >
                                {isExpanded ? (
                                    <ChevronDown size={12} />
                                ) : (
                                    <ChevronRight size={12} />
                                )}
                                <span>+{allChunks.length - 1} more matches</span>
                            </button>
                        )}
                        <AnimatePresence>
                            {isExpanded && hasMultipleChunks && (
                                <motion.ul
                                    className="semantic-chunks-list"
                                    variants={chunkListVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    {allChunks.slice(1).map((chunk, i) => (
                                        <li
                                            key={chunk.blockId || i}
                                            className="semantic-chunk-item"
                                            onClick={(e) => handleChunkClick(e, chunk.sourceBlockId || chunk.blockId)}
                                        >
                                            {chunk.headingContext && (
                                                <span className="chunk-context">{chunk.headingContext}</span>
                                            )}
                                            <span className="chunk-content">{chunk.content}</span>
                                        </li>
                                    ))}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </>
                ) : (
                    // Document Variant: Main Title + Optional Inline Snippet
                    <>
                        <span className="doc-title">{title}</span>
                        {snippet && <span className="doc-snippet">{snippet}</span>}
                    </>
                )}
            </div>

            {/* Actions (Delete) - Mostly for document variant */}
            {onDelete && (
                <div className="doc-actions">
                    <button
                        className="action-btn danger"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={onDelete}
                        title={STRINGS.TOOLTIPS.DELETE}
                        aria-label={`${STRINGS.TOOLTIPS.DELETE} ${title}`}
                    >
                        <Trash2 size={14} aria-hidden="true" />
                    </button>
                </div>
            )}
        </motion.li>
    );
}
