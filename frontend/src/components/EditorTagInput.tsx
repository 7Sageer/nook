import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Tag } from 'lucide-react';
import { Button, ListBox, ListBoxItem } from 'react-aria-components';
import { useTagContext } from '../contexts/TagContext';
import './EditorTagInput.css';

interface EditorTagInputProps {
    tags: string[];
    docId: string;
    onAddTag: (docId: string, tag: string) => void;
    onRemoveTag: (docId: string, tag: string) => void;
    onTagClick?: (tag: string) => void;
}

export const EditorTagInput = memo(function EditorTagInput({
    tags,
    docId,
    onAddTag,
    onRemoveTag,
    onTagClick,
}: EditorTagInputProps) {
    const { allTags, tagColors, suggestedTags, isLoadingSuggestions, fetchSuggestedTags, clearSuggestedTags } = useTagContext();
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [removingTag, setRemovingTag] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Handle tag removal with animation
    const handleRemoveTag = useCallback((tag: string) => {
        setRemovingTag(tag);
        setTimeout(() => {
            onRemoveTag(docId, tag);
            setRemovingTag(null);
        }, 150); // Match CSS animation duration
    }, [docId, onRemoveTag]);

    // Filter suggestions based on input, prioritize suggested tags when no input
    const suggestions = (() => {
        const notAlreadySelected = (name: string) => !tags.includes(name);

        if (!inputValue.trim()) {
            // No input: show suggested tags first, then other tags
            const suggestedMap = new Map(suggestedTags.map(s => [s.name, s.count]));
            const suggested = suggestedTags
                .filter(s => notAlreadySelected(s.name))
                .map(s => {
                    const tagInfo = allTags.find(t => t.name === s.name);
                    const count = tagInfo?.count ?? 0;
                    return {
                        name: s.name,
                        count,
                        color: tagColors[s.name],
                        relevance: s.count,
                        // 计算百分比用于排序
                        percent: count > 0 ? s.count / count : 0,
                    };
                })
                // 按百分比降序排序
                .sort((a, b) => b.percent - a.percent);
            const others = allTags
                .filter(t => notAlreadySelected(t.name) && !suggestedMap.has(t.name))
                .slice(0, 5 - suggested.length)
                .map(t => ({ ...t, relevance: 0 }));
            return [...suggested, ...others].slice(0, 5);
        } else {
            // Has input: filter all tags normally
            return allTags
                .filter(t => {
                    const matchesInput = t.name.toLowerCase().includes(inputValue.toLowerCase());
                    return matchesInput && notAlreadySelected(t.name);
                })
                .slice(0, 5)
                .map(t => ({ ...t, relevance: 0 }));
        }
    })();

    // Reset highlighted index when suggestions change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [suggestions.length, inputValue]);

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

    // Fetch suggested tags when entering add mode
    useEffect(() => {
        if (isAdding && docId) {
            fetchSuggestedTags(docId);
        }
        return () => {
            if (!isAdding) {
                clearSuggestedTags();
            }
        };
    }, [isAdding, docId, fetchSuggestedTags, clearSuggestedTags]);

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
        setHighlightedIndex(-1);
    }, [docId, onAddTag, tags]);



    const handleTagClick = useCallback((e: React.MouseEvent, tag: string) => {
        e.stopPropagation();
        onTagClick?.(tag);
    }, [onTagClick]);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        // e.stopPropagation(); // Allow global shortcuts to propagate

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (suggestions.length > 0) {
                setHighlightedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (suggestions.length > 0) {
                setHighlightedIndex(prev =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                // 选择高亮的建议
                addTag(suggestions[highlightedIndex].name);
            } else if (inputValue.trim()) {
                // 没有高亮项时，使用输入的文本
                addTag(inputValue);
            }
        } else if (e.key === 'Escape') {
            setInputValue('');
            setIsAdding(false);
            setHighlightedIndex(-1);
        } else if (e.key === 'Tab' && suggestions.length > 0 && highlightedIndex >= 0) {
            // Tab 键选择当前高亮项
            e.preventDefault();
            addTag(suggestions[highlightedIndex].name);
        }
    }, [inputValue, addTag, suggestions, highlightedIndex]);

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
            setHighlightedIndex(-1);
        }, 150);
    }, [inputValue, docId, onAddTag, tags]);

    // Focus input when adding mode is activated
    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAdding]);


    return (
        <div
            className="editor-tag-container"
            role="group"
            aria-label="Document tags"
        >
            {/* Show tag icon when there are no tags */}
            {tags.length === 0 && !isAdding && (
                <button
                    type="button"
                    className="editor-tag-empty"
                    onClick={handleAddClick}
                    aria-label="Add tag"
                >
                    <Tag size={12} aria-hidden="true" />
                    <span>Add tag</span>
                </button>
            )}

            {/* Display all tags */}
            {tags.map((tag) => {
                const color = tagColors[tag];
                return (
                    <span
                        key={tag}
                        className={`editor-tag-badge ${removingTag === tag ? 'removing' : ''}`}
                        role="listitem"
                        title={tag}
                        style={color ? { '--tag-badge-color': color } as React.CSSProperties : undefined}
                    >
                        {color && <span className="editor-tag-dot" style={{ backgroundColor: color }} aria-hidden="true" />}
                        <button
                            type="button"
                            className="editor-tag-text"
                            onClick={(e) => handleTagClick(e, tag)}
                        >
                            {tag}
                        </button>
                        <Button
                            className="editor-tag-remove"
                            onPress={() => handleRemoveTag(tag)}
                            aria-label={`Remove tag ${tag}`}
                        >
                            <X size={10} aria-hidden="true" />
                        </Button>
                    </span>
                );
            })}

            {/* Add tag input or button */}
            {isAdding ? (
                <div className="editor-tag-input-wrapper" ref={wrapperRef}>
                    <input
                        ref={inputRef}
                        type="text"
                        className="editor-tag-input"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        placeholder="Tag name"
                        maxLength={20}
                        aria-label="Enter tag name"
                        aria-autocomplete="list"
                        aria-controls={suggestions.length > 0 ? "editor-tag-suggestions" : undefined}
                    />
                    {!isLoadingSuggestions && suggestions.length > 0 && dropdownPosition && createPortal(
                        <ListBox
                            id="editor-tag-suggestions"
                            aria-label="Tag suggestions"
                            className="editor-tag-suggestions"
                            items={suggestions.map((item, index) => ({ ...item, index }))}
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
                                    className={`editor-tag-suggestion-item ${item.index === highlightedIndex ? 'highlighted' : ''}`}
                                    onAction={() => addTag(item.name)}
                                >
                                    {item.color && (
                                        <span
                                            className="editor-tag-suggestion-dot"
                                            style={{ backgroundColor: item.color }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="editor-tag-suggestion-name">{item.name}</span>
                                    {item.relevance > 0 && item.count > 0 && (
                                        <span
                                            className="editor-tag-suggestion-badge"
                                            title={`${item.relevance}/${item.count} 篇相似`}
                                        >
                                            {Math.round((item.relevance / item.count) * 100)}%
                                        </span>
                                    )}
                                    <span className="editor-tag-suggestion-count" aria-label={`${item.count} documents`}>
                                        {item.count}
                                    </span>
                                </ListBoxItem>
                            )}
                        </ListBox>,
                        document.body
                    )}

                </div>
            ) : tags.length > 0 && (
                <button
                    type="button"
                    className="editor-tag-add-btn"
                    onClick={handleAddClick}
                    aria-label="Add tag"
                >
                    <Plus size={12} aria-hidden="true" />
                </button>
            )}
        </div>
    );
});
