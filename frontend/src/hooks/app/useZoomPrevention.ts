import { useEffect } from 'react';

/**
 * 禁用 WebView 缩放功能，防止用户误触导致界面缩放
 * - 禁用 Ctrl+滚轮 缩放
 * - 禁用 Ctrl+/Ctrl-/Ctrl+0 键盘快捷键
 * - 禁用触控板双指捏合缩放
 */
export function useZoomPrevention() {
    useEffect(() => {
        // 禁用 Ctrl+滚轮 缩放
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        };

        // 禁用 Ctrl+/Ctrl-/Ctrl+0 键盘缩放
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
                e.preventDefault();
            }
        };

        // 添加事件监听器
        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('keydown', handleKeyDown);

        // 设置 CSS 禁用触控板捏合缩放
        document.documentElement.style.touchAction = 'pan-x pan-y';

        return () => {
            document.removeEventListener('wheel', handleWheel);
            document.removeEventListener('keydown', handleKeyDown);
            document.documentElement.style.touchAction = '';
        };
    }, []);
}
