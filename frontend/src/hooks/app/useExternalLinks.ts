import { useEffect } from 'react';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';

/**
 * Hook to handle external link clicks in Wails WebView.
 * Since WebView doesn't support window.open() or "Open in new tab",
 * this intercepts link clicks and opens them in the system browser.
 */
export function useExternalLinks() {
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');

            if (anchor && anchor.href) {
                const href = anchor.href;

                // Skip javascript: and empty links
                if (href.startsWith('javascript:') || href === '#') {
                    return;
                }

                // Handle external links (http/https)
                if (href.startsWith('http://') || href.startsWith('https://')) {
                    e.preventDefault();
                    e.stopPropagation();
                    BrowserOpenURL(href);
                }
            }
        };

        // Add listener to capture phase to intercept before other handlers
        document.addEventListener('click', handleClick, true);

        return () => {
            document.removeEventListener('click', handleClick, true);
        };
    }, []);
}
