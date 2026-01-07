import { useEffect, DependencyList } from 'react';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

// 事件处理器类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (...args: any[]) => void;

// 事件映射类型
type EventMap = Record<string, EventHandler | undefined>;

/**
 * 通用 Wails 事件监听 hook
 * 自动处理事件订阅和清理
 *
 * @param events - 事件名称到处理器的映射，undefined 的处理器会被忽略
 * @param deps - 依赖数组，当依赖变化时重新订阅事件
 *
 * @example
 * useWailsEvents({
 *   'menu:new-document': handleNewDocument,
 *   'menu:import': handleImport,
 *   'file:open': isEnabled ? handleFileOpen : undefined,
 * }, [handleNewDocument, handleImport, isEnabled, handleFileOpen]);
 */
export function useWailsEvents(
    events: EventMap,
    deps: DependencyList = []
) {
    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        for (const [eventName, handler] of Object.entries(events)) {
            if (handler) {
                unsubscribers.push(EventsOn(eventName, handler));
            }
        }

        return () => {
            unsubscribers.forEach((unsub) => unsub());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
