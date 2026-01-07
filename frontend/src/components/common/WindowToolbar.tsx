import { useState, useRef, useEffect } from 'react';
import { Plus, PanelLeftClose, PanelLeft, FileText, FolderPlus, Cog } from 'lucide-react';
import { WindowControls } from './WindowControls';
import { getStrings } from '../../constants/strings';
import { useSettings } from '../../contexts/SettingsContext';

interface WindowToolbarProps {
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    onCreateDocument: () => void;
    onCreateFolder: () => void;
    onSettings: () => void;
    theme: 'light' | 'dark';
}

export function WindowToolbar({
    sidebarCollapsed,
    onToggleSidebar,
    onCreateDocument,
    onCreateFolder,
    onSettings,
    theme,
}: WindowToolbarProps) {
    const { language } = useSettings();
    const STRINGS = getStrings(language);
    // 下拉菜单状态
    const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
    const createMenuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
                setIsCreateMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isCreateMenuOpen) {
                setIsCreateMenuOpen(false);
            }
        };

        if (isCreateMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCreateMenuOpen]);

    const handleCreateDocument = () => {
        onCreateDocument();
        setIsCreateMenuOpen(false);
    };

    const handleCreateFolder = () => {
        onCreateFolder();
        setIsCreateMenuOpen(false);
    };

    // 同时渲染两种状态，用 CSS 控制过渡动画
    const [isWindows, setIsWindows] = useState(false);

    useEffect(() => {
        // Check OS
        window.go?.main?.App?.GetOS().then((os: string) => {
            setIsWindows(os === 'windows');
        });
    }, []);

    return (
        <div className={`window-toolbar ${theme} ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${isWindows ? 'is-windows' : ''}`}>
            {/* Window Controls (Top Right) - Only for Windows */}
            {isWindows && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    zIndex: 9999,
                    height: '100%',
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag'
                } as React.CSSProperties}>
                    <WindowControls theme={theme} />
                </div>
            )}

            {/* 展开状态：侧边栏顶部的工具栏 */}
            <div className={`toolbar-drag-region toolbar-expanded ${sidebarCollapsed ? 'hidden' : ''}`}>
                <div className="toolbar-buttons">
                    <div className="create-menu-wrapper" ref={createMenuRef}>
                        <button
                            className={`icon-btn icon-btn-sm primary create-menu-trigger ${isCreateMenuOpen ? 'menu-open' : ''}`}
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                            title={STRINGS.TOOLTIPS.NEW_DOC}
                            aria-label={STRINGS.TOOLTIPS.NEW_DOC}
                            aria-expanded={isCreateMenuOpen}
                            aria-haspopup="menu"
                        >
                            <Plus size={14} className="plus-icon" aria-hidden="true" />
                        </button>
                        {isCreateMenuOpen && (
                            <div className="create-menu-dropdown" role="menu">
                                <button className="create-menu-item" onClick={handleCreateDocument} role="menuitem">
                                    <FileText size={16} aria-hidden="true" />
                                    <span>{STRINGS.MENU.NEW_DOC}</span>
                                </button>
                                <button className="create-menu-item" onClick={handleCreateFolder} role="menuitem">
                                    <FolderPlus size={16} aria-hidden="true" />
                                    <span>{STRINGS.MENU.NEW_PINNED_TAG}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        className="icon-btn icon-btn-sm toolbar-settings-btn"
                        onClick={onSettings}
                        title={STRINGS.SETTINGS.TITLE}
                        aria-label={STRINGS.SETTINGS.TITLE}
                    >
                        <Cog size={14} aria-hidden="true" />
                    </button>
                    <button
                        className="icon-btn icon-btn-sm collapse-btn"
                        onClick={onToggleSidebar}
                        title={STRINGS.TOOLTIPS.COLLAPSE}
                        aria-label={STRINGS.TOOLTIPS.COLLAPSE}
                    >
                        <PanelLeftClose size={14} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* 折叠状态：展开按钮 */}
            <div className={`toolbar-drag-region toolbar-collapsed ${sidebarCollapsed ? '' : 'hidden'}`}>
                <button
                    className="icon-btn icon-btn-sm expand-sidebar-btn"
                    onClick={onToggleSidebar}
                    title={STRINGS.TOOLTIPS.EXPAND}
                    aria-label={STRINGS.TOOLTIPS.EXPAND}
                >
                    <PanelLeft size={14} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
