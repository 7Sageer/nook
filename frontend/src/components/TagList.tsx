import { memo, useState, useCallback, useEffect } from 'react';
import { Tag, MoreVertical } from 'lucide-react';
import type { TagInfo } from '../types/document';
import { TagContextMenu } from './TagContextMenu';
import { useDocumentContext } from '../contexts/DocumentContext';
import './TagList.css';

interface TagListProps {
    tags: TagInfo[];
    selectedTag: string | null;
    onSelectTag: (tag: string | null) => void;
    tagColors: Record<string, string>;
}

export const TagList = memo(function TagList({
    tags,
    selectedTag,
    onSelectTag,
    tagColors,
}: TagListProps) {
    const { setTagColor, pinTag, unpinTag, pinnedTags, renameTag, deleteTag } = useDocumentContext();
    const [contextMenu, setContextMenu] = useState<{
        tagName: string;
        position: { x: number; y: number };
    } | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, tagName: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            tagName,
            position: { x: e.clientX, y: e.clientY },
        });
    }, []);

    // Handle click on more button - opens the same context menu
    const handleMoreClick = useCallback((e: React.MouseEvent, tagName: string) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({
            tagName,
            position: { x: rect.left, y: rect.bottom + 4 },
        });
    }, []);

    const handleColorSelect = useCallback(async (tagName: string, color: string) => {
        await setTagColor(tagName, color);
    }, [setTagColor]);

    const handlePinTag = useCallback(async (tagName: string) => {
        await pinTag(tagName);
    }, [pinTag]);

    const handleUnpinTag = useCallback(async (tagName: string) => {
        await unpinTag(tagName);
    }, [unpinTag]);

    const handleRenameTag = useCallback(async (oldName: string, newName: string) => {
        await renameTag(oldName, newName);
    }, [renameTag]);

    const handleDeleteTag = useCallback(async (tagName: string) => {
        // If the deleted tag is currently selected, clear the selection
        if (selectedTag === tagName) {
            onSelectTag(null);
        }
        await deleteTag(tagName);
    }, [deleteTag, selectedTag, onSelectTag]);

    // ESC 键取消选择标签
    useEffect(() => {
        if (!selectedTag) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onSelectTag(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedTag, onSelectTag]);

    if (tags.length === 0) {
        return null;
    }

    const sortedTags = [...tags].sort((a, b) => b.count - a.count);

    return (
        <>
            <div className="tag-list-section" role="region" aria-label="Tags">
                <div className="section-label-row">
                    <span className="section-label">
                        <Tag size={12} style={{ marginRight: 4 }} />
                        Tags
                    </span>
                    {selectedTag && (
                        <button
                            className="tag-clear-btn"
                            onClick={() => onSelectTag(null)}
                            title="Show all documents"
                            aria-label="Clear tag filter"
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="tag-list" role="listbox" aria-label="Available tags">

                    {sortedTags.map((tag) => {
                        const color = tagColors[tag.name] || tag.color;
                        return (
                            <div
                                key={tag.name}
                                role="button"
                                tabIndex={0}
                                className={`tag-list-item ${selectedTag === tag.name ? 'active' : ''}`}
                                onClick={() => onSelectTag(selectedTag === tag.name ? null : tag.name)}
                                onContextMenu={(e) => handleContextMenu(e, tag.name)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelectTag(selectedTag === tag.name ? null : tag.name);
                                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const currentElement = e.currentTarget as HTMLElement;
                                        const nextSibling = currentElement.nextElementSibling as HTMLElement;
                                        nextSibling?.focus();
                                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const currentElement = e.currentTarget as HTMLElement;
                                        const prevSibling = currentElement.previousElementSibling as HTMLElement;
                                        prevSibling?.focus();
                                    } else if (e.key === 'Tab') {
                                        // macOS WebKit Tab 键兼容处理
                                        const currentElement = e.currentTarget as HTMLElement;
                                        if (e.shiftKey) {
                                            const prevSibling = currentElement.previousElementSibling as HTMLElement;
                                            if (prevSibling) {
                                                e.preventDefault();
                                                prevSibling.focus();
                                            } else {
                                                e.preventDefault();
                                                const searchInput = document.querySelector('.search-input') as HTMLElement;
                                                searchInput?.focus();
                                            }
                                        } else {
                                            const nextSibling = currentElement.nextElementSibling as HTMLElement;
                                            if (nextSibling) {
                                                e.preventDefault();
                                                nextSibling.focus();
                                            } else {
                                                e.preventDefault();
                                                const nextFocusable = document.querySelector('.folders-section [tabindex="0"], .folders-section button, .uncategorized-section [tabindex="0"], .uncategorized-section button, .document-item') as HTMLElement;
                                                nextFocusable?.focus();
                                            }
                                        }
                                    }
                                }}
                                style={color ? { '--tag-color': color } as React.CSSProperties : undefined}
                            >
                                <span
                                    className="tag-dot"
                                    style={color ? { backgroundColor: color } : undefined}
                                />
                                <span className="tag-name">{tag.name}</span>
                                <span className="tag-count">{tag.count}</span>
                                <button
                                    className="tag-more-btn"
                                    onClick={(e) => handleMoreClick(e, tag.name)}
                                    title="More options"
                                    aria-label="More options"
                                >
                                    <MoreVertical size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>

            </div>

            {contextMenu && (
                <TagContextMenu
                    tagName={contextMenu.tagName}
                    currentColor={tagColors[contextMenu.tagName]}
                    isPinned={pinnedTags.some(t => t.name === contextMenu.tagName)}
                    position={contextMenu.position}
                    onPin={handlePinTag}
                    onUnpin={handleUnpinTag}
                    onColorSelect={handleColorSelect}
                    onRename={handleRenameTag}
                    onDelete={handleDeleteTag}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </>
    );
});
