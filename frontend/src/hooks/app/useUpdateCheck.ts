import { useEffect } from 'react';
import { CheckForUpdates } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { useToast } from '../../components/common/Toast';

/**
 * 启动时自动检查更新
 * - 延迟 3 秒后检查，避免影响首次加载体验
 * - 使用 sessionStorage 防止同一会话重复提示
 */
export function useUpdateCheck() {
    const { showToast } = useToast();

    useEffect(() => {
        // 同一会话只检查一次
        const hasChecked = sessionStorage.getItem('nook-update-checked');
        if (hasChecked) return;

        const timer = setTimeout(async () => {
            try {
                const info = await CheckForUpdates();
                sessionStorage.setItem('nook-update-checked', 'true');

                if (info.hasUpdate) {
                    showToast(
                        `New version ${info.latestVersion} available! Click to view.`,
                        'info',
                        {
                            duration: 10000,
                            onClick: () => BrowserOpenURL(info.releaseURL),
                        }
                    );
                }
            } catch (err) {
                // 静默失败，不影响用户体验
                console.warn('[UpdateCheck] Failed to check for updates:', err);
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [showToast]);
}
