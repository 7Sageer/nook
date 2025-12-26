import { memo, useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import './TagInput.css';

interface TagInputProps {
    tags: string[];
    docId: string;
    onAddTag: (docId: string, tag: string) => void;
    onRemoveTag: (docId: string, tag: string) => void;
    onTagClick?: (tag: string) => void;
}

export const TagInput = memo(function TagInput({
    tags,
    docId,
    onAddTag,
    onRemoveTag,
    onTagClick,
}: TagInputProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const handleAddClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAdding(true);
    }, []);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            const trimmed = inputValue.trim();
            if (trimmed) {
                onAddTag(docId, trimmed);
                setInputValue('');
                setIsAdding(false);
            }
        } else if (e.key === 'Escape') {
            setInputValue('');
            setIsAdding(false);
        }
    }, [inputValue, docId, onAddTag]);

    const handleInputBlur = useCallback(() => {
        const trimmed = inputValue.trim();
        if (trimmed) {
            onAddTag(docId, trimmed);
        }
        setInputValue('');
        setIsAdding(false);
    }, [inputValue, docId, onAddTag]);

    const handleRemoveClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onRemoveTag(docId, tag);
    }, [docId, onRemoveTag]);

    const handleTagClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onTagClick?.(tag);
    }, [onTagClick]);

    const MAX_VISIBLE_TAGS = 2;
    const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
    const hiddenCount = tags.length - MAX_VISIBLE_TAGS;

    return (
        <div className="tag-container" onClick={(e) => e.stopPropagation()}>
            {visibleTags.map((tag) => (
                <span
                    key={tag}
                    className="tag-badge"
                    onClick={(e) => handleTagClick(e, tag)}
                    title={tag}
                >
                    {tag}
                    <button
                        className="tag-remove"
                        onClick={(e) => handleRemoveClick(e, tag)}
                        aria-label={`Remove tag ${tag}`}
                    >
                        <X size={10} />
                    </button>
                </span>
            ))}
            {hiddenCount > 0 && (
                <span
                    className="tag-badge tag-more"
                    title={tags.slice(MAX_VISIBLE_TAGS).join(', ')}
                >
                    +{hiddenCount}
                </span>
            )}
            {isAdding ? (
                <input
                    type="text"
                    className="tag-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onBlur={handleInputBlur}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="标签名"
                    autoFocus
                    maxLength={20}
                />
            ) : (
                <button
                    className="add-tag-btn"
                    onClick={handleAddClick}
                    aria-label="Add tag"
                >
                    <Plus size={10} />
                </button>
            )}
        </div>
    );
});
