
import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { listItemVariants } from '../utils/animations';

interface SearchResultItemProps {
    title: string;
    snippet?: string;
    icon?: ReactNode;
    matchCount?: number;
    isActive: boolean;
    variant?: 'semantic' | 'document';
    onClick: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    index: number;
}

export function SearchResultItem({
    title,
    snippet,
    icon,
    matchCount,
    isActive,
    variant = 'document',
    onClick,
    onDelete,
    index,
}: SearchResultItemProps) {
    const isSemantic = variant === 'semantic';

    // Base classes
    const containerClass = isSemantic
        ? `document-item semantic-item ${isActive ? 'active' : ''}`
        : `document-item ${isActive ? 'active' : ''}`;

    return (
        <motion.li
            layout
            variants={listItemVariants}
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
                        {matchCount && matchCount > 1 && (
                            <span className="semantic-more">
                                +{matchCount - 1} more matches
                            </span>
                        )}
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
