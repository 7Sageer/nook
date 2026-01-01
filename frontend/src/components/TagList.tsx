import { memo, useState, useCallback, useEffect } from 'react';
import { Tag } from 'lucide-react';
import type { TagInfo } from '../types/document';
import { TagColorPicker } from './TagColorPicker';
import { useDocumentContext } from '../contexts/DocumentContext';
import './TagList.css';
import './TagColorPicker.css';

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
    const { setTagColor } = useDocumentContext();
    const [colorPicker, setColorPicker] = useState<{
        tagName: string;
        position: { x: number; y: number };
    } | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, tagName: string) => {
        e.preventDefault();
        e.stopPropagation();
        setColorPicker({
            tagName,
            position: { x: e.clientX, y: e.clientY },
        });
    }, []);

    const handleColorSelect = useCallback(async (tagName: string, color: string) => {
        await setTagColor(tagName, color);
    }, [setTagColor]);

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
                            <button
                                key={tag.name}
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
                                            // Shift+Tab: 移动到上一个标签或搜索框
                                            const prevSibling = currentElement.previousElementSibling as HTMLElement;
                                            if (prevSibling) {
                                                e.preventDefault();
                                                prevSibling.focus();
                                            } else {
                                                // 第一个标签，跳转回搜索框
                                                e.preventDefault();
                                                const searchInput = document.querySelector('.search-input') as HTMLElement;
                                                searchInput?.focus();
                                            }
                                        } else {
                                            // Tab: 移动到下一个标签或下一区域
                                            const nextSibling = currentElement.nextElementSibling as HTMLElement;
                                            if (nextSibling) {
                                                e.preventDefault();
                                                nextSibling.focus();
                                            } else {
                                                // 最后一个标签，跳转到标签组区域的第一个可聚焦元素
                                                e.preventDefault();
                                                const nextFocusable = document.querySelector('.folders-section [tabindex="0"], .folders-section button, .uncategorized-section [tabindex="0"], .uncategorized-section button, .document-item') as HTMLElement;
                                                nextFocusable?.focus();
                                            }
                                        }
                                    }
                                }}
                                style={color ? { '--tag-color': color } as React.CSSProperties : undefined}
                                title="Right-click to set color"
                            >
                                <span
                                    className="tag-dot"
                                    style={color ? { backgroundColor: color } : undefined}
                                />
                                <span className="tag-name">{tag.name}</span>
                                <span className="tag-count">{tag.count}</span>
                            </button>
                        );
                    })}
                </div>

            </div>

            {colorPicker && (
                <TagColorPicker
                    tagName={colorPicker.tagName}
                    currentColor={tagColors[colorPicker.tagName]}
                    onSelectColor={handleColorSelect}
                    onClose={() => setColorPicker(null)}
                    position={colorPicker.position}
                />
            )}
        </>
    );
});
