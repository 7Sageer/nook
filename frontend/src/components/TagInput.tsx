import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus } from 'lucide-react';
import { Button, ListBox, ListBoxItem } from 'react-aria-components';
import { useDocumentContext } from '../contexts/DocumentContext';
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
    const { allTags, tagColors } = useDocumentContext();
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input
    const suggestions = inputValue.trim()
        ? allTags
            .filter(t =>
                t.name.toLowerCase().includes(inputValue.toLowerCase()) &&
                !tags.includes(t.name)
            )
            .slice(0, 5)
        : [];

    // Calculate dropdown position for portal
    useEffect(() => {
        if (isAdding && suggestions.length > 0 && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left,
            });
        }
    }, [isAdding, suggestions.length]);

    const handleAddClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAdding(true);
    }, []);

    const addTag = useCallback((tagName: string) => {
        const trimmed = tagName.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onAddTag(docId, trimmed);
        }
        setInputValue('');
        setIsAdding(false);
    }, [docId, onAddTag, tags]);

    const handleRemove = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onRemoveTag(docId, tag);
    }, [docId, onRemoveTag]);

    const handleTagClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onTagClick?.(tag);
    }, [onTagClick]);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' && inputValue.trim()) {
            addTag(inputValue);
        } else if (e.key === 'Escape') {
            setInputValue('');
            setIsAdding(false);
        }
    }, [inputValue, addTag]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    }, []);

    const handleInputBlur = useCallback(() => {
        // Delay to allow click on suggestion
        setTimeout(() => {
            const trimmed = inputValue.trim();
            if (trimmed && !tags.includes(trimmed)) {
                onAddTag(docId, trimmed);
            }
            setInputValue('');
            setIsAdding(false);
        }, 150);
    }, [inputValue, docId, onAddTag, tags]);

    const MAX_VISIBLE_TAGS = 2;
    const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
    const hiddenCount = tags.length - MAX_VISIBLE_TAGS;

    // Focus input when adding mode is activated
    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAdding]);

    return (
        <div
            className="tag-container"
            onClick={(e) => e.stopPropagation()}
            role="group"
            aria-label="Document tags"
        >
            {visibleTags.map((tag) => {
                const color = tagColors[tag];
                return (
                    <span
                        key={tag}
                        className="tag-badge"
                        role="listitem"
                        title={tag}
                        style={color ? { '--tag-badge-color': color } as React.CSSProperties : undefined}
                    >
                        {color && <span className="tag-badge-dot" style={{ backgroundColor: color }} aria-hidden="true" />}
                        <span
                            className="tag-text"
                            onClick={(e) => handleTagClick(e, tag)}
                        >
                            {tag}
                        </span>
                        <Button
                            className="tag-remove"
                            onPress={() => onRemoveTag(docId, tag)}
                            aria-label={`Remove tag ${tag}`}
                        >
                            <X size={10} aria-hidden="true" />
                        </Button>
                    </span>
                );
            })}

            {hiddenCount > 0 && (
                <span
                    className="tag-badge tag-more"
                    title={tags.slice(MAX_VISIBLE_TAGS).join(', ')}
                    aria-label={`${hiddenCount} more tags`}
                >
                    +{hiddenCount}
                </span>
            )}

            {isAdding ? (
                <div className="tag-input-wrapper" ref={wrapperRef}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="tag-input"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Tag"
                        maxLength={20}
                        aria-label="Enter tag name"
                        aria-autocomplete="list"
                        aria-controls={suggestions.length > 0 ? "tag-suggestions" : undefined}
                    />
                    {suggestions.length > 0 && dropdownPosition && createPortal(
                        <ListBox
                            id="tag-suggestions"
                            aria-label="Tag suggestions"
                            className="tag-suggestions tag-suggestions-portal"
                            items={suggestions}
                            selectionMode="single"
                            style={{
                                position: 'fixed',
                                top: dropdownPosition.top,
                                left: dropdownPosition.left,
                            }}
                        >
                            {(item) => (
                                <ListBoxItem
                                    key={item.name}
                                    id={item.name}
                                    textValue={item.name}
                                    className="tag-suggestion-item"
                                    onAction={() => addTag(item.name)}
                                >
                                    {item.color && (
                                        <span
                                            className="tag-suggestion-dot"
                                            style={{ backgroundColor: item.color }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="tag-suggestion-name">{item.name}</span>
                                    <span className="tag-suggestion-count" aria-label={`${item.count} documents`}>
                                        {item.count}
                                    </span>
                                </ListBoxItem>
                            )}
                        </ListBox>,
                        document.body
                    )}
                </div>
            ) : (
                <Button
                    className="add-tag-btn"
                    onPress={() => setIsAdding(true)}
                    aria-label="Add tag"
                >
                    <Plus size={10} aria-hidden="true" />
                </Button>
            )}
        </div>
    );
});
