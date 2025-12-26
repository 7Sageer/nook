import { memo, useState, useCallback } from 'react';
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

    if (tags.length === 0) {
        return null;
    }

    const sortedTags = [...tags].sort((a, b) => b.count - a.count);

    return (
        <>
            <div className="tag-list-section">
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
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="tag-list">
                    {sortedTags.map((tag) => {
                        const color = tagColors[tag.name] || tag.color;
                        return (
                            <button
                                key={tag.name}
                                className={`tag-list-item ${selectedTag === tag.name ? 'active' : ''}`}
                                onClick={() => onSelectTag(selectedTag === tag.name ? null : tag.name)}
                                onContextMenu={(e) => handleContextMenu(e, tag.name)}
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
