import { memo, useState, useCallback, useRef, useEffect } from 'react';

// Predefined tag color palette
export const TAG_COLORS = [
    { name: 'red', value: '#ef4444' },
    { name: 'orange', value: '#f97316' },
    { name: 'yellow', value: '#eab308' },
    { name: 'green', value: '#22c55e' },
    { name: 'blue', value: '#3b82f6' },
    { name: 'purple', value: '#a855f7' },
    { name: 'pink', value: '#ec4899' },
    { name: 'gray', value: '#6b7280' },
];

interface TagColorPickerProps {
    tagName: string;
    currentColor?: string;
    onSelectColor: (tagName: string, color: string) => void;
    onClose: () => void;
    position: { x: number; y: number };
}

export const TagColorPicker = memo(function TagColorPicker({
    tagName,
    currentColor,
    onSelectColor,
    onClose,
    position,
}: TagColorPickerProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleColorClick = useCallback((color: string) => {
        onSelectColor(tagName, color);
        onClose();
    }, [tagName, onSelectColor, onClose]);

    return (
        <div
            ref={ref}
            className="tag-color-picker"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
            }}
        >
            <div className="tag-color-picker-header">
                Set color for "{tagName}"
            </div>
            <div className="tag-color-picker-grid">
                {TAG_COLORS.map(({ name, value }) => (
                    <button
                        key={name}
                        className={`tag-color-option ${currentColor === value ? 'active' : ''}`}
                        style={{ backgroundColor: value }}
                        onClick={() => handleColorClick(value)}
                        title={name}
                    />
                ))}
                <button
                    className={`tag-color-option tag-color-none ${!currentColor ? 'active' : ''}`}
                    onClick={() => handleColorClick('')}
                    title="No color"
                >
                    ×
                </button>
            </div>
        </div>
    );
});
