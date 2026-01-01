import { memo, useEffect, useRef, useState } from 'react';
import { Pin, PinOff, Palette } from 'lucide-react';
import { TagColorPicker } from './TagColorPicker';
import { getStrings } from '../constants/strings';
import { useSettings } from '../contexts/SettingsContext';
import './TagContextMenu.css';

interface TagContextMenuProps {
    tagName: string;
    currentColor?: string;
    isPinned: boolean;
    position: { x: number; y: number };
    onPin: (tagName: string) => void;
    onUnpin: (tagName: string) => void;
    onColorSelect: (tagName: string, color: string) => void;
    onClose: () => void;
}

export const TagContextMenu = memo(function TagContextMenu({
    tagName,
    currentColor,
    isPinned,
    position,
    onPin,
    onUnpin,
    onColorSelect,
    onClose,
}: TagContextMenuProps) {
    const { language } = useSettings();
    const STRINGS = getStrings(language);
    const menuRef = useRef<HTMLDivElement>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerPosition, setColorPickerPosition] = useState(position);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handlePinClick = () => {
        if (isPinned) {
            onUnpin(tagName);
        } else {
            onPin(tagName);
        }
        onClose();
    };

    const handleColorClick = (e: React.MouseEvent) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setColorPickerPosition({ x: rect.right + 4, y: rect.top });
        setShowColorPicker(true);
    };

    const handleColorSelect = (name: string, color: string) => {
        onColorSelect(name, color);
        onClose();
    };

    // 调整位置避免超出视口
    const adjustedPosition = { ...position };
    if (typeof window !== 'undefined') {
        const menuWidth = 160;
        const menuHeight = 80;
        if (position.x + menuWidth > window.innerWidth) {
            adjustedPosition.x = window.innerWidth - menuWidth - 8;
        }
        if (position.y + menuHeight > window.innerHeight) {
            adjustedPosition.y = window.innerHeight - menuHeight - 8;
        }
    }

    return (
        <div
            ref={menuRef}
            className="tag-context-menu"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            <button className="tag-context-menu-item" onClick={handlePinClick}>
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                <span>{isPinned ? STRINGS.TOOLTIPS.UNPIN_TAG : STRINGS.TOOLTIPS.PIN_TAG}</span>
            </button>
            <button className="tag-context-menu-item" onClick={handleColorClick}>
                <Palette size={14} />
                <span>Set Color</span>
            </button>

            {showColorPicker && (
                <TagColorPicker
                    tagName={tagName}
                    currentColor={currentColor}
                    onSelectColor={handleColorSelect}
                    onClose={() => setShowColorPicker(false)}
                    position={colorPickerPosition}
                />
            )}
        </div>
    );
});
