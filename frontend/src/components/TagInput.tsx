import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
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
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input
    const suggestions = inputValue.trim()
        ? allTags
            .filter(t =>
                t.name.toLowerCase().includes(inputValue.toLowerCase()) &&
                !tags.includes(t.name)
            )
            .slice(0, 5)
        : [];

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions.length]);

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
        setShowSuggestions(false);
    }, [docId, onAddTag, tags]);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();

        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
                e.preventDefault();
                addTag(suggestions[selectedIndex].name);
                return;
            }
        }

        if (e.key === 'Enter') {
            addTag(inputValue);
        } else if (e.key === 'Escape') {
            setInputValue('');
            setIsAdding(false);
            setShowSuggestions(false);
        }
    }, [inputValue, showSuggestions, suggestions, selectedIndex, addTag]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setShowSuggestions(true);
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
            setShowSuggestions(false);
        }, 150);
    }, [inputValue, docId, onAddTag, tags]);

    const handleRemoveClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onRemoveTag(docId, tag);
    }, [docId, onRemoveTag]);

    const handleTagClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onTagClick?.(tag);
    }, [onTagClick]);

    const handleSuggestionClick = useCallback((e: React.MouseEvent, tagName: string) => {
        e.stopPropagation();
        e.preventDefault();
        addTag(tagName);
    }, [addTag]);

    const MAX_VISIBLE_TAGS = 2;
    const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
    const hiddenCount = tags.length - MAX_VISIBLE_TAGS;

    return (
        <div className="tag-container" onClick={(e) => e.stopPropagation()}>
            {visibleTags.map((tag) => {
                const color = tagColors[tag];
                return (
                    <span
                        key={tag}
                        className="tag-badge"
                        onClick={(e) => handleTagClick(e, tag)}
                        title={tag}
                        style={color ? { '--tag-badge-color': color } as React.CSSProperties : undefined}
                    >
                        {color && <span className="tag-badge-dot" style={{ backgroundColor: color }} />}
                        {tag}
                        <button
                            className="tag-remove"
                            onClick={(e) => handleRemoveClick(e, tag)}
                            aria-label={`Remove tag ${tag}`}
                        >
                            <X size={10} />
                        </button>
                    </span>
                );
            })}
            {hiddenCount > 0 && (
                <span
                    className="tag-badge tag-more"
                    title={tags.slice(MAX_VISIBLE_TAGS).join(', ')}
                >
                    +{hiddenCount}
                </span>
            )}
            {isAdding ? (
                <div className="tag-input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        className="tag-input"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Tag"
                        autoFocus
                        maxLength={20}
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="tag-suggestions" ref={suggestionsRef}>
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion.name}
                                    className={`tag-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                                    onMouseDown={(e) => handleSuggestionClick(e, suggestion.name)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    {suggestion.color && (
                                        <span
                                            className="tag-suggestion-dot"
                                            style={{ backgroundColor: suggestion.color }}
                                        />
                                    )}
                                    <span className="tag-suggestion-name">{suggestion.name}</span>
                                    <span className="tag-suggestion-count">{suggestion.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
