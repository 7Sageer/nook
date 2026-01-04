
import { ReactNode, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { listItemVariants, durations, easings } from '../utils/animations';
import type { ChunkMatch } from '../types/document';
import { FileText, Link2, File, FolderOpen } from 'lucide-react';

// 按来源类型分组的 chunks
interface GroupedChunks {
    document: ChunkMatch[];
    bookmark: Map<string, ChunkMatch[]>; // key: sourceTitle or sourceBlockId
    file: Map<string, ChunkMatch[]>;
    folder: ChunkMatch[];
}

// 将 chunks 按来源类型分组
function groupChunksBySource(chunks: ChunkMatch[]): GroupedChunks {
    const result: GroupedChunks = {
        document: [],
        bookmark: new Map(),
        file: new Map(),
        folder: [],
    };

    for (const chunk of chunks) {
        const type = chunk.sourceType || 'document';
        if (type === 'bookmark') {
            const key = chunk.sourceTitle || chunk.sourceBlockId || 'unknown';
            const existing = result.bookmark.get(key) || [];
            existing.push(chunk);
            result.bookmark.set(key, existing);
        } else if (type === 'file') {
            const key = chunk.sourceTitle || chunk.sourceBlockId || 'unknown';
            const existing = result.file.get(key) || [];
            existing.push(chunk);
            result.file.set(key, existing);
        } else if (type === 'folder') {
            result.folder.push(chunk);
        } else {
            result.document.push(chunk);
        }
    }

    return result;
}

interface SearchResultItemProps {
    title: string;
    snippet?: string;
    icon?: ReactNode;
    matchCount?: number;
    score?: number;  // 相似度分数 (0-1)
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

// Source type badge configuration
const SOURCE_TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string; className: string }> = {
    document: { icon: FileText, label: 'Doc', className: 'badge-document' },
    bookmark: { icon: Link2, label: 'Web', className: 'badge-bookmark' },
    file: { icon: File, label: 'File', className: 'badge-file' },
    folder: { icon: FolderOpen, label: 'Folder', className: 'badge-folder' },
};

// Render source type badge
const SourceTypeBadge = ({ sourceType }: { sourceType?: string }) => {
    if (!sourceType || sourceType === 'document') return null;
    const config = SOURCE_TYPE_CONFIG[sourceType];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <span className={`source-type-badge ${config.className}`}>
            <Icon size={10} />
            <span>{config.label}</span>
        </span>
    );
};

// 渲染单个 chunk 内容
interface ChunkItemProps {
    chunk: ChunkMatch;
    showContext?: boolean;
    onClick: (blockId: string) => void;
}

const ChunkItem = ({ chunk, showContext = true, onClick }: ChunkItemProps) => (
    <li
        className="semantic-chunk-item"
        tabIndex={0}
        role="option"
        onClick={(e) => {
            e.stopPropagation();
            onClick(chunk.sourceBlockId || chunk.blockId);
        }}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClick(chunk.sourceBlockId || chunk.blockId);
            }
        }}
    >
        {showContext && chunk.headingContext && (
            <span className="chunk-context">{chunk.headingContext}</span>
        )}
        <span className="chunk-content">{chunk.content}</span>
    </li>
);

// 渲染来源分组（bookmark/file）
interface SourceGroupProps {
    sourceType: 'bookmark' | 'file';
    title: string;
    chunks: ChunkMatch[];
    onChunkClick: (blockId: string) => void;
}

const SourceGroup = ({ sourceType, title, chunks, onChunkClick }: SourceGroupProps) => {
    const config = SOURCE_TYPE_CONFIG[sourceType];
    const Icon = config.icon;

    return (
        <div className="source-group">
            <div className="source-group-header">
                <Icon size={12} className={`source-group-icon ${config.className}`} />
                <span className="source-group-title">{title}</span>
            </div>
            <ul className="source-group-chunks">
                {chunks.map((chunk, i) => (
                    <ChunkItem
                        key={chunk.blockId || i}
                        chunk={chunk}
                        showContext={false}
                        onClick={onChunkClick}
                    />
                ))}
            </ul>
        </div>
    );
};


export function SearchResultItem({
    title,
    snippet,
    icon,
    score,
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

    // 按来源类型分组 chunks（跳过第一个，因为它已经显示在主区域）
    const groupedChunks = useMemo(() => {
        if (!allChunks || allChunks.length <= 1) return null;
        return groupChunksBySource(allChunks.slice(1));
    }, [allChunks]);

    // 获取第一个 chunk 的来源信息
    const firstChunk = allChunks?.[0];
    const firstChunkSourceType = firstChunk?.sourceType;
    const firstChunkSourceTitle = firstChunk?.sourceTitle;

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



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            // 如果已展开且有 chunks，进入 chunks 列表
            if (isExpanded && hasMultipleChunks) {
                const currentElement = e.currentTarget as HTMLElement;
                const firstChunk = currentElement.querySelector('.semantic-chunk-item') as HTMLElement;
                if (firstChunk) {
                    firstChunk.focus();
                    return;
                }
            }
            // 否则导航到下一个结果项
            const currentElement = e.currentTarget as HTMLElement;
            const nextSibling = currentElement.nextElementSibling as HTMLElement;
            if (nextSibling?.classList.contains('document-item')) {
                nextSibling.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            // 导航到上一个结果项
            const currentElement = e.currentTarget as HTMLElement;
            const prevSibling = currentElement.previousElementSibling as HTMLElement;
            if (prevSibling?.classList.contains('document-item')) {
                prevSibling.focus();
            }
        } else if (e.key === 'ArrowRight' && hasMultipleChunks) {
            e.preventDefault();
            if (!isExpanded) {
                // 展开并聚焦第一个 chunk
                setIsExpanded(true);
                // 需要等待 DOM 更新后再聚焦
                setTimeout(() => {
                    const currentElement = e.currentTarget as HTMLElement;
                    const firstChunk = currentElement.querySelector('.semantic-chunk-item') as HTMLElement;
                    firstChunk?.focus();
                }, 100);
            } else {
                // 已展开，直接聚焦第一个 chunk
                const currentElement = e.currentTarget as HTMLElement;
                const firstChunk = currentElement.querySelector('.semantic-chunk-item') as HTMLElement;
                firstChunk?.focus();
            }
        } else if (e.key === 'ArrowLeft' && hasMultipleChunks) {
            // 折叠语义搜索结果
            e.preventDefault();
            setIsExpanded(false);
        }
    };


    return (
        <motion.li
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={containerClass}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="option"
            aria-selected={isActive}
            tabIndex={0}
            custom={{ index, isActive }}
        >

            {/* Icon - Only for document variant typically, or if provided */}
            {icon && <div className="doc-icon">{icon}</div>}

            <div className="doc-content">
                {isSemantic ? (
                    // Semantic Variant: Small Title + Content Snippet + Score
                    <>
                        <div className="semantic-header">
                            <span className="semantic-doc-title">{title}</span>
                            {score !== undefined && (
                                <span className="semantic-score">{Math.round(score * 100)}%</span>
                            )}
                        </div>
                        {/* 如果第一个匹配来自 bookmark/file，显示来源标题 */}
                        {firstChunkSourceType && firstChunkSourceType !== 'document' && (
                            <div className="semantic-source-info">
                                <SourceTypeBadge sourceType={firstChunkSourceType} />
                                {firstChunkSourceTitle && (
                                    <span className="semantic-source-title">{firstChunkSourceTitle}</span>
                                )}
                            </div>
                        )}
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
                            {isExpanded && hasMultipleChunks && groupedChunks && (
                                <motion.div
                                    className="semantic-chunks-grouped"
                                    variants={chunkListVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    {/* 文档内容匹配 */}
                                    {groupedChunks.document.length > 0 && (
                                        <ul className="semantic-chunks-list" role="list">
                                            {groupedChunks.document.map((chunk, i) => (
                                                <ChunkItem
                                                    key={chunk.blockId || `doc-${i}`}
                                                    chunk={chunk}
                                                    onClick={(blockId) => onChunkClick?.(blockId)}
                                                />
                                            ))}
                                        </ul>
                                    )}

                                    {/* 书签来源分组 */}
                                    {Array.from(groupedChunks.bookmark.entries()).map(([title, chunks]) => (
                                        <SourceGroup
                                            key={`bookmark-${title}`}
                                            sourceType="bookmark"
                                            title={title}
                                            chunks={chunks}
                                            onChunkClick={(blockId) => onChunkClick?.(blockId)}
                                        />
                                    ))}

                                    {/* 文件来源分组 */}
                                    {Array.from(groupedChunks.file.entries()).map(([title, chunks]) => (
                                        <SourceGroup
                                            key={`file-${title}`}
                                            sourceType="file"
                                            title={title}
                                            chunks={chunks}
                                            onChunkClick={(blockId) => onChunkClick?.(blockId)}
                                        />
                                    ))}

                                    {/* 文件夹来源 */}
                                    {groupedChunks.folder.length > 0 && (
                                        <ul className="semantic-chunks-list" role="list">
                                            {groupedChunks.folder.map((chunk, i) => (
                                                <ChunkItem
                                                    key={chunk.blockId || `folder-${i}`}
                                                    chunk={chunk}
                                                    onClick={(blockId) => onChunkClick?.(blockId)}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </motion.div>
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
