import { useEffect, useCallback, useRef } from 'react';

/**
 * 全局快捷键定义
 * 使用 mod 表示 Cmd (macOS) / Ctrl (Windows/Linux)
 */
export const SHORTCUTS = {
    SEARCH: { key: 'k', mod: true },        // Cmd+K - 搜索
    NEW_DOCUMENT: { key: 'n', mod: true },  // Cmd+N - 新建文档
    TOGGLE_SIDEBAR: { key: '\\', mod: true }, // Cmd+\ - 切换侧边栏
    SETTINGS: { key: ',', mod: true },      // Cmd+, - 设置
} as const;

interface UseKeyboardNavigationOptions {
    /** 打开搜索回调 */
    onSearch?: () => void;
    /** 新建文档回调 */
    onNewDocument?: () => void;
    /** 切换侧边栏回调 */
    onToggleSidebar?: () => void;
    /** 打开设置回调 */
    onSettings?: () => void;
    /** 是否启用快捷键 (当模态框打开时可禁用) */
    enabled?: boolean;
}

/**
 * 全局键盘导航 Hook
 * 统一管理应用级快捷键
 */
export function useKeyboardNavigation({
    onSearch,
    onNewDocument,
    onToggleSidebar,
    onSettings,
    enabled = true,
}: UseKeyboardNavigationOptions) {
    // 使用 ref 存储回调，避免 effect 重新执行
    const callbacksRef = useRef({
        onSearch,
        onNewDocument,
        onToggleSidebar,
        onSettings,
    });

    // 更新 ref
    useEffect(() => {
        callbacksRef.current = {
            onSearch,
            onNewDocument,
            onToggleSidebar,
            onSettings,
        };
    }, [onSearch, onNewDocument, onToggleSidebar, onSettings]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // 检查是否按下了修饰键
        const isMod = e.metaKey || e.ctrlKey;

        // 在输入框中时，只响应带修饰键的快捷键
        const isInputFocused =
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            (e.target instanceof HTMLElement && e.target.isContentEditable);

        // Cmd+K - 搜索
        if (isMod && e.key === 'k') {
            // 如果在编辑区域，不拦截 Cmd+K，让编辑器处理（通常是添加链接）
            if (e.target instanceof HTMLElement && e.target.isContentEditable) {
                return;
            }
            e.preventDefault();
            callbacksRef.current.onSearch?.();
            return;
        }

        // Cmd+P - 搜索 (全局通用，类似 VS Code / Notion)
        if (isMod && e.key === 'p') {
            e.preventDefault();
            callbacksRef.current.onSearch?.();
            return;
        }

        // Cmd+N - 新建文档 (不在输入框中时)
        if (isMod && e.key === 'n' && !isInputFocused) {
            e.preventDefault();
            callbacksRef.current.onNewDocument?.();
            return;
        }

        // Cmd+\ - 切换侧边栏
        if (isMod && e.key === '\\') {
            e.preventDefault();
            callbacksRef.current.onToggleSidebar?.();
            return;
        }

        // Cmd+, - 设置
        if (isMod && e.key === ',') {
            e.preventDefault();
            callbacksRef.current.onSettings?.();
            return;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}

/**
 * 列表键盘导航 Hook
 * 用于侧边栏文档列表等可导航列表
 */
export interface ListNavigationItem {
    id: string;
    element?: HTMLElement | null;
}

interface UseListKeyboardNavOptions {
    items: ListNavigationItem[];
    activeId?: string | null;
    onSelect?: (id: string) => void;
    onDelete?: (id: string) => void;
    /** 容器元素 ref */
    containerRef?: React.RefObject<HTMLElement>;
    /** 是否启用 */
    enabled?: boolean;
}

/**
 * 列表键盘导航 Hook
 * 支持上下箭头导航、Enter 选择、Delete 删除
 */
export function useListKeyboardNav({
    items,
    activeId,
    onSelect,
    onDelete,
    containerRef,
    enabled = true,
}: UseListKeyboardNavOptions) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled || items.length === 0) return;

        // 检查焦点是否在容器内
        if (containerRef?.current && !containerRef.current.contains(document.activeElement)) {
            return;
        }

        const currentIndex = items.findIndex(item => item.id === activeId);

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                const nextItem = items[nextIndex];
                if (nextItem) {
                    // 尝试聚焦元素
                    const element = nextItem.element ||
                        document.querySelector(`[data-doc-id="${nextItem.id}"]`) as HTMLElement;
                    element?.focus();
                    onSelect?.(nextItem.id);
                }
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                const prevItem = items[prevIndex];
                if (prevItem) {
                    const element = prevItem.element ||
                        document.querySelector(`[data-doc-id="${prevItem.id}"]`) as HTMLElement;
                    element?.focus();
                    onSelect?.(prevItem.id);
                }
                break;
            }
            case 'Enter':
            case ' ': {
                if (activeId) {
                    e.preventDefault();
                    onSelect?.(activeId);
                }
                break;
            }
            case 'Delete':
            case 'Backspace': {
                if (activeId && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    onDelete?.(activeId);
                }
                break;
            }
        }
    }, [items, activeId, onSelect, onDelete, containerRef, enabled]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}

/**
 * 焦点区域 ID
 */
export type FocusZone = 'sidebar' | 'editor' | 'search';

interface UseFocusZoneOptions {
    /** 当前焦点区域 */
    currentZone?: FocusZone;
    /** 区域切换回调 */
    onZoneChange?: (zone: FocusZone) => void;
    /** 侧边栏 ref */
    sidebarRef?: React.RefObject<HTMLElement>;
    /** 编辑器 ref */
    editorRef?: React.RefObject<HTMLElement>;
    /** 搜索输入框 ref */
    searchRef?: React.RefObject<HTMLInputElement>;
    /** 是否启用 */
    enabled?: boolean;
}

/**
 * 焦点区域管理 Hook
 * F6 在主要区域间循环切换
 * Escape 返回编辑器
 */
export function useFocusZone({
    onZoneChange,
    sidebarRef,
    editorRef,
    searchRef,
    enabled = true,
}: UseFocusZoneOptions) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const zones: FocusZone[] = ['sidebar', 'editor'];

        if (!enabled) return;

        // F6 - 区域切换
        if (e.key === 'F6') {
            e.preventDefault();

            // 确定当前区域
            const activeElement = document.activeElement;
            let currentZone: FocusZone = 'editor';

            if (sidebarRef?.current?.contains(activeElement)) {
                currentZone = 'sidebar';
            } else if (searchRef?.current === activeElement) {
                currentZone = 'search';
            }

            // 切换到下一个区域
            const currentIndex = zones.indexOf(currentZone);
            const nextIndex = (currentIndex + 1) % zones.length;
            const nextZone = zones[nextIndex];

            // 聚焦目标区域
            if (nextZone === 'sidebar') {
                // 聚焦侧边栏第一个可聚焦元素
                const firstFocusable = sidebarRef?.current?.querySelector(
                    'button, [tabindex]:not([tabindex="-1"]), input'
                ) as HTMLElement;
                firstFocusable?.focus();
            } else if (nextZone === 'editor') {
                // 聚焦编辑器
                const editorContent = editorRef?.current?.querySelector(
                    '[contenteditable="true"]'
                ) as HTMLElement;
                editorContent?.focus();
            }

            onZoneChange?.(nextZone);
        }

        // Escape - 返回编辑器（如果不在模态框中）
        if (e.key === 'Escape') {
            const activeElement = document.activeElement;

            // 检查是否在模态框中
            const isInModal = !!activeElement?.closest('[role="dialog"]');
            if (isInModal) return;

            // 如果在侧边栏或搜索框中，返回编辑器
            const isInSidebar = sidebarRef?.current?.contains(activeElement);
            const isInSearch = searchRef?.current === activeElement;

            if (isInSidebar || isInSearch) {
                e.preventDefault();
                const editorContent = editorRef?.current?.querySelector(
                    '[contenteditable="true"]'
                ) as HTMLElement;
                editorContent?.focus();
                onZoneChange?.('editor');
            }
        }
    }, [enabled, sidebarRef, editorRef, searchRef, onZoneChange]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}
