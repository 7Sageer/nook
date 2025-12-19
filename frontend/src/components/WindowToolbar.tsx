import { useState, useRef, useEffect } from 'react';
import { Plus, Moon, Sun, Monitor, PanelLeftClose, PanelLeft, FileText, FolderPlus } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface WindowToolbarProps {
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    onCreateDocument: () => void;
    onCreateFolder: () => void;
    themeSetting: 'light' | 'dark' | 'system';
    onToggleTheme: () => void;
    theme: 'light' | 'dark';
}

export function WindowToolbar({
    sidebarCollapsed,
    onToggleSidebar,
    onCreateDocument,
    onCreateFolder,
    themeSetting,
    onToggleTheme,
    theme,
}: WindowToolbarProps) {
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

        if (isCreateMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
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

    // Get theme icon based on current setting
    const getThemeIcon = () => {
        switch (themeSetting) {
            case 'light':
                return <Sun size={14} />;
            case 'dark':
                return <Moon size={14} />;
            case 'system':
                return <Monitor size={14} />;
        }
    };

    const getThemeTooltip = () => {
        switch (themeSetting) {
            case 'light':
                return STRINGS.TOOLTIPS.THEME_LIGHT;
            case 'dark':
                return STRINGS.TOOLTIPS.THEME_DARK;
            case 'system':
                return STRINGS.TOOLTIPS.THEME_SYSTEM;
        }
    };

    // 同时渲染两种状态，用 CSS 控制过渡动画
    return (
        <div className={`window-toolbar ${theme} ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
            {/* 展开状态：侧边栏顶部的工具栏 */}
            <div className={`toolbar-drag-region toolbar-expanded ${sidebarCollapsed ? 'hidden' : ''}`}>
                <div className="toolbar-buttons">
                    <div className="create-menu-wrapper" ref={createMenuRef}>
                        <button
                            className={`icon-btn icon-btn-sm primary create-menu-trigger ${isCreateMenuOpen ? 'menu-open' : ''}`}
                            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                            title={STRINGS.TOOLTIPS.NEW_DOC}
                        >
                            <Plus size={14} className="plus-icon" />
                        </button>
                        {isCreateMenuOpen && (
                            <div className="create-menu-dropdown">
                                <button className="create-menu-item" onClick={handleCreateDocument}>
                                    <FileText size={16} />
                                    <span>{STRINGS.MENU.NEW_DOC}</span>
                                </button>
                                <button className="create-menu-item" onClick={handleCreateFolder}>
                                    <FolderPlus size={16} />
                                    <span>{STRINGS.MENU.NEW_FOLDER}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button className="icon-btn icon-btn-sm theme-btn" onClick={onToggleTheme} title={getThemeTooltip()}>
                        {getThemeIcon()}
                    </button>
                    <button className="icon-btn icon-btn-sm collapse-btn" onClick={onToggleSidebar} title={STRINGS.TOOLTIPS.COLLAPSE}>
                        <PanelLeftClose size={14} />
                    </button>
                </div>
            </div>

            {/* 折叠状态：展开按钮 */}
            <div className={`toolbar-drag-region toolbar-collapsed ${sidebarCollapsed ? '' : 'hidden'}`}>
                <button
                    className="icon-btn icon-btn-sm expand-sidebar-btn"
                    onClick={onToggleSidebar}
                    title={STRINGS.TOOLTIPS.EXPAND}
                >
                    <PanelLeft size={14} />
                </button>
            </div>
        </div>
    );
}
