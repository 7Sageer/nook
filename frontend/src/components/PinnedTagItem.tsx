import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { DocumentMeta, TagInfo } from '../types/document';
import { ChevronRight, Tag, Pencil, Trash2, Plus, PinOff, Palette, MoreVertical } from 'lucide-react';
import { getStrings } from '../constants/strings';
import { useSettings } from '../contexts/SettingsContext';
import { TagColorPicker } from './TagColorPicker';
import { AnimatePresence, motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { docInstanceDndId } from '../utils/dnd';
import { DND_CONSTANTS } from '../constants/strings';
import { SortableDocItem } from './SortableDocItem';
import './PinnedTagItem.css';

interface PinnedTagItemProps {
    tag: TagInfo;
    index: number;
    documents: DocumentMeta[];
    disabled: boolean;
    activeDocId: string | null;
    onToggle: (name: string) => void;
    onRename: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
    onUnpin?: (name: string) => void;
    onColorSelect?: (tagName: string, color: string) => void;
    onSelectDocument: (id: string) => void;
    onDeleteDocument: (id: string) => void;
    onEditingChange?: (name: string | null) => void;
    onAddDocument?: (tagName: string) => void;
}

export const PinnedTagItem = memo(function PinnedTagItem({
    tag,

    documents,

    activeDocId,
    onToggle,
    onRename,
    onDelete,
    onUnpin,
    onColorSelect,
    onSelectDocument,
    onDeleteDocument,
    onEditingChange,
    onAddDocument,
}: PinnedTagItemProps) {
    const { DOC_CONTAINER_HEADER_PREFIX, DOC_CONTAINER_LIST_PREFIX } = DND_CONSTANTS;
    const { language } = useSettings();
    const STRINGS = getStrings(language);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tag.name);
    const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number } | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const sortedDocs = useMemo(() => {
        return [...documents].sort((a, b) => a.order - b.order);
    }, [documents]);

    const isCollapsed = tag.collapsed ?? false;
    const hasDocuments = documents.length > 0;

    const handleColorClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const pickerWidth = 170;
        const pickerHeight = 120;
        let x = rect.right + 4;
        let y = rect.top;
        if (x + pickerWidth > window.innerWidth) {
            x = rect.left - pickerWidth - 4;
        }
        if (y + pickerHeight > window.innerHeight) {
            y = window.innerHeight - pickerHeight - 8;
        }
        setColorPickerPos({ x, y });
    }, []);

    const handleColorSelect = useCallback((name: string, color: string) => {
        onColorSelect?.(name, color);
        setColorPickerPos(null);
    }, [onColorSelect]);

    const {
        setNodeRef: setHeaderDroppableRef,
        isOver: isHeaderOver,
    } = useDroppable({
        id: `${DOC_CONTAINER_HEADER_PREFIX}${tag.name}`,
        data: { type: 'doc-container', containerId: tag.name, collapsed: isCollapsed, role: 'header' },
        disabled: !isCollapsed && hasDocuments,
    });

    const {
        setNodeRef: setListDroppableRef,
        isOver: isListOver,
    } = useDroppable({
        id: `${DOC_CONTAINER_LIST_PREFIX}${tag.name}`,
        data: { type: 'doc-container', containerId: tag.name, collapsed: isCollapsed, role: 'list' },
        disabled: isCollapsed || hasDocuments,
    });

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== tag.name) {
            onRename(tag.name, editName.trim());
        }
        setIsEditing(false);
        onEditingChange?.(null);
    };

    const startEditing = () => {
        setEditName(tag.name);
        setIsEditing(true);
        onEditingChange?.(tag.name);
    };

    // Close more menu when clicking outside
    useEffect(() => {
        if (!showMoreMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMoreMenu]);

    const handleMoreMenuClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMoreMenu(prev => !prev);
    }, []);

    return (
        <>
            <motion.div
                className={`folder-item ${(isHeaderOver || isListOver) ? 'drop-target' : ''}`}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
            >
                <div
                    ref={setHeaderDroppableRef}
                    className="folder-header"
                    onClick={() => onToggle(tag.name)}
                    role="treeitem"
                    aria-expanded={!isCollapsed}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle(tag.name);
                        } else if (e.key === 'ArrowRight' && isCollapsed) {
                            e.preventDefault();
                            onToggle(tag.name);
                        } else if (e.key === 'ArrowLeft' && !isCollapsed) {
                            e.preventDefault();
                            onToggle(tag.name);
                        }
                    }}
                >
                    <span className={`folder-chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                        <ChevronRight size={16} aria-hidden="true" />
                    </span>
                    <Tag size={16} className="folder-icon" aria-hidden="true" style={tag.color ? { color: tag.color } : undefined} />
                    {isEditing ? (
                        <input
                            type="text"
                            className="folder-rename-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="folder-name"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEditing();
                            }}
                        >{tag.name}</span>
                    )}
                    {!isEditing && (
                        <span className="folder-count">{documents.length}</span>
                    )}
                    {!isEditing && (
                        <div className="folder-actions" ref={moreMenuRef}>
                            {onAddDocument && (
                                <button
                                    className="action-btn"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddDocument(tag.name);
                                    }}
                                    title={STRINGS.TOOLTIPS.PINNED_TAG_ADD_DOC}
                                    aria-label={STRINGS.TOOLTIPS.PINNED_TAG_ADD_DOC}
                                >
                                    <Plus size={14} aria-hidden="true" />
                                </button>
                            )}
                            <button
                                className="action-btn"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleMoreMenuClick}
                                title="More options"
                                aria-label="More options"
                                aria-expanded={showMoreMenu}
                            >
                                <MoreVertical size={14} aria-hidden="true" />
                            </button>
                            {showMoreMenu && (
                                <div className="folder-more-menu">
                                    {onColorSelect && (
                                        <button
                                            className="folder-more-menu-item"
                                            onClick={(e) => {
                                                handleColorClick(e);
                                                setShowMoreMenu(false);
                                            }}
                                        >
                                            <Palette size={14} />
                                            <span>Set Color</span>
                                        </button>
                                    )}
                                    {onUnpin && (
                                        <button
                                            className="folder-more-menu-item"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMoreMenu(false);
                                                onUnpin(tag.name);
                                            }}
                                        >
                                            <PinOff size={14} />
                                            <span>{STRINGS.TOOLTIPS.UNPIN_TAG}</span>
                                        </button>
                                    )}
                                    <button
                                        className="folder-more-menu-item"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMoreMenu(false);
                                            startEditing();
                                        }}
                                    >
                                        <Pencil size={14} />
                                        <span>{STRINGS.TOOLTIPS.PINNED_TAG_RENAME}</span>
                                    </button>
                                    <button
                                        className="folder-more-menu-item danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMoreMenu(false);
                                            onDelete(tag.name);
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        <span>{STRINGS.TOOLTIPS.PINNED_TAG_DELETE}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div
                    ref={setListDroppableRef}
                    className={`folder-documents ${isCollapsed ? 'collapsed' : ''}`}
                    role="group"
                    aria-label={`${tag.name} 中的文档`}
                >
                    <div className="folder-documents-inner">
                        <SortableContext items={sortedDocs.map(d => docInstanceDndId(tag.name, d.id))} strategy={verticalListSortingStrategy}>
                            <AnimatePresence mode="popLayout">
                                {sortedDocs.map((doc, index) => (
                                    <SortableDocItem
                                        key={doc.id}
                                        item={doc}
                                        index={index}
                                        containerId={tag.name}
                                        activeId={activeDocId}
                                        onSelect={onSelectDocument}
                                        onDelete={onDeleteDocument}
                                        inFolder
                                        hidden={isCollapsed}
                                    />
                                ))}
                            </AnimatePresence>
                        </SortableContext>
                    </div>
                </div>
            </motion.div>
            {
                colorPickerPos && onColorSelect && (
                    <TagColorPicker
                        tagName={tag.name}
                        currentColor={tag.color}
                        onSelectColor={handleColorSelect}
                        onClose={() => setColorPickerPos(null)}
                        position={colorPickerPos}
                    />
                )
            }
        </>
    );
});
