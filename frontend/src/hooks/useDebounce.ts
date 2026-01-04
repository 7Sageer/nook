import { useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * 返回一个防抖版本的函数。
 * 使用 ref 存储最新的 callback，避免因 callback 变化导致防抖失效。
 * returns also a cancel method to clear the timeout.
 * @param callback 需要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数 & { cancel: () => void }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounce<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useRef(callback);

    // 始终保持 callbackRef 指向最新的 callback
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const debouncedFunc = useCallback(
        (...args: Parameters<T>) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    );

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Attach cancel method to the debounced function
    const func = useMemo(() => {
        const f = debouncedFunc as ((...args: Parameters<T>) => void) & { cancel: () => void };
        f.cancel = cancel;
        return f;
    }, [debouncedFunc, cancel]);

    return func;
}
