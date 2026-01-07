import { useEffect, useRef } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

/**
 * 文件变更事件结构
 */
export interface FileChangeEvent {
    type: 'create' | 'write' | 'remove' | 'rename';
    path: string;
    isIndex: boolean;
    docId: string;
}

interface UseFileWatcherOptions {
    /**
     * 当文档索引发生变化时调用（新建、删除、重命名文档）
     */
    onIndexChange?: (event: FileChangeEvent) => void;

    /**
     * 当文档内容发生变化时调用
     */
    onDocumentChange?: (event: FileChangeEvent) => void;

    /**
     * 是否启用监听（可选，默认 true）
     */
    enabled?: boolean;
}

/**
 * 监听文件系统变化事件的 Hook
 * 
 * 当外部程序（如 Agent）直接修改文件系统中的笔记时，
 * 此 Hook 会接收来自 Go 后端的通知事件
 */
export function useFileWatcher({
    onIndexChange,
    onDocumentChange,
    enabled = true,
}: UseFileWatcherOptions = {}) {
    // 使用 ref 保存回调以避免频繁重新订阅
    const onIndexChangeRef = useRef(onIndexChange);
    const onDocumentChangeRef = useRef(onDocumentChange);

    // 更新 ref
    useEffect(() => {
        onIndexChangeRef.current = onIndexChange;
        onDocumentChangeRef.current = onDocumentChange;
    }, [onIndexChange, onDocumentChange]);

    useEffect(() => {
        if (!enabled) return;

        const unsubscribers: (() => void)[] = [];

        // 监听索引变化事件
        unsubscribers.push(
            EventsOn('file:index-changed', (event: FileChangeEvent) => {
                onIndexChangeRef.current?.(event);
            })
        );

        // 监听文档内容变化事件
        unsubscribers.push(
            EventsOn('file:document-changed', (event: FileChangeEvent) => {
                onDocumentChangeRef.current?.(event);
            })
        );

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [enabled]);
}

/**
 * 简化版 Hook：仅返回是否有变化的标志
 * 可用于触发刷新
 */
export function useFileWatcherRefresh(
    onRefreshNeeded: () => void,
    enabled = true
) {
    useFileWatcher({
        onIndexChange: onRefreshNeeded,
        onDocumentChange: onRefreshNeeded,
        enabled,
    });
}
