import { useEffect, useRef } from "react";

// Set to true to enable debug logging
const DEBUG = false;

function debugLog(...args: unknown[]) {
    if (DEBUG) console.log('[DragFix]', ...args);
}

/**
 * useDragPreviewFix - Fixes the drag preview (ghost image) issue in Wails WebView.
 * 
 * Problem: In Wails WebView (WKWebView on macOS), the default drag ghost image
 * may capture incorrect elements from the app instead of just the block content.
 * 
 * Solution: We create a custom overlay element that follows the mouse during drag,
 * completely bypassing the browser's native drag ghost image mechanism.
 */
export function useDragPreviewFix() {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const dragImageRef = useRef<HTMLImageElement | null>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        // Only enable this workaround inside Wails (WKWebView) runtime.
        // In a regular browser BlockNote's native drag preview works correctly.
        if (typeof (window as any).runtime === "undefined") {
            return;
        }

        debugLog('Hook initialized');

        let mouseX = 0;
        let mouseY = 0;

        // Create a tiny invisible image used to override the native drag ghost.
        // WebKit is picky here: using an actual <img> is the most reliable option.
        // It also needs to be attached to the DOM.
        const dragImageEl = new Image();
        dragImageEl.src =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        dragImageEl.alt = "";
        dragImageEl.id = "bn-transparent-drag-image";
        dragImageEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
        `;
        document.body.appendChild(dragImageEl);
        dragImageRef.current = dragImageEl;

        /**
         * Track mouse position for overlay positioning
         */
        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (overlayRef.current && isDraggingRef.current) {
                overlayRef.current.style.left = `${mouseX + 15}px`;
                overlayRef.current.style.top = `${mouseY + 15}px`;
            }
        };

        /**
         * Handle drag start - create overlay
         */
        const handleDragStart = (e: DragEvent) => {
            const isCapturePhase = e.eventPhase === Event.CAPTURING_PHASE;

            debugLog('dragstart event fired');

            const target = e.target as HTMLElement | null;
            if (!target) return;

            // We run in both capture and bubble phases:
            // - capture: try to override BEFORE BlockNote
            // - bubble: try to override AFTER BlockNote
            // WKWebView differs across versions on which call "wins".
            const sideMenu = target.closest('.bn-side-menu');

            if (!sideMenu) {
                return;
            }

            // Make sure we're in the BlockNote editor
            const editorWrapper = target.closest('.bn-editor') ?? document.querySelector('.bn-editor');

            if (!editorWrapper) {
                return;
            }

            // Always override the native ghost (WKWebView may snapshot the wrong region).
            if (e.dataTransfer && dragImageRef.current) {
                try {
                    e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
                    debugLog('setDragImage called');
                } catch (err) {
                    console.error('[DragFix] setDragImage error:', err);
                }
            }

            // Only build the custom overlay once, in capture phase.
            if (!isCapturePhase) {
                return;
            }

            // Find the hovered block
            const hoveredBlock = findHoveredBlock(target);

            if (!hoveredBlock) {
                debugLog('No block found');
                return;
            }

            // Create and show the custom overlay
            const overlay = createOverlay(hoveredBlock);

            if (overlay) {
                overlay.style.left = `${mouseX + 15}px`;
                overlay.style.top = `${mouseY + 15}px`;
                document.body.appendChild(overlay);
                overlayRef.current = overlay;
                isDraggingRef.current = true;

                // Trigger fade-in animation
                requestAnimationFrame(() => {
                    if (overlay) overlay.style.opacity = '1';
                });

                debugLog('Overlay added to DOM');
            }
        };

        /**
         * Handle drag end - remove overlay
         */
        const handleDragEnd = () => {
            debugLog('dragend/drop event');
            if (overlayRef.current) {
                overlayRef.current.remove();
                overlayRef.current = null;
            }
            isDraggingRef.current = false;
        };

        /**
         * Handle drag - update visibility during drag
         */
        const handleDrag = (e: DragEvent) => {
            // During drag, mouse position might be 0,0 at the end
            if (e.clientX !== 0 && e.clientY !== 0) {
                mouseX = e.clientX;
                mouseY = e.clientY;
            }

            if (overlayRef.current && isDraggingRef.current) {
                overlayRef.current.style.left = `${mouseX + 15}px`;
                overlayRef.current.style.top = `${mouseY + 15}px`;
            }
        };

        // Use capture phase for motion updates.
        document.addEventListener('mousemove', handleMouseMove);
        // Listen to dragstart in BOTH phases (see comment in handler).
        document.addEventListener('dragstart', handleDragStart, true);
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('drag', handleDrag, true);
        document.addEventListener('dragend', handleDragEnd, true);
        document.addEventListener('drop', handleDragEnd, true);

        debugLog('Event listeners registered');

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('dragstart', handleDragStart, true);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('drag', handleDrag, true);
            document.removeEventListener('dragend', handleDragEnd, true);
            document.removeEventListener('drop', handleDragEnd, true);

            if (overlayRef.current) {
                overlayRef.current.remove();
                overlayRef.current = null;
            }
            if (dragImageRef.current) {
                dragImageRef.current.remove();
                dragImageRef.current = null;
            }
            debugLog('Cleanup complete');
        };
    }, []);
}

/**
 * Find the block element being dragged
 */
function findHoveredBlock(target: HTMLElement): Element | null {
    // Method 1: BlockNote marks hovered blocks with data attribute
    const hoveredBlock = document.querySelector('.bn-block-outer[data-is-hovered="true"]');
    if (hoveredBlock) return hoveredBlock;

    // Method 2: Find by side menu position - use center point for better accuracy
    const sideMenu = target.closest('.bn-side-menu');
    if (sideMenu) {
        const menuRect = sideMenu.getBoundingClientRect();
        // Use the vertical center of the side menu for matching
        const menuCenterY = menuRect.top + menuRect.height / 2;

        const blocks = document.querySelectorAll('.bn-block-outer');
        let bestMatch: Element | null = null;
        let bestDistance = Infinity;

        for (const block of blocks) {
            const blockRect = block.getBoundingClientRect();
            const blockCenterY = blockRect.top + blockRect.height / 2;

            // Check if menu center is within the block's vertical bounds
            if (menuCenterY >= blockRect.top && menuCenterY <= blockRect.bottom) {
                return block; // Direct hit - return immediately
            }

            // Track the closest block
            const distance = Math.abs(menuCenterY - blockCenterY);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = block;
            }
        }

        // Return the closest block if within reasonable distance (50px)
        if (bestMatch && bestDistance < 50) {
            return bestMatch;
        }
    }

    // Method 3: Fallback - closest block outer from target
    return target.closest('.bn-block-outer');
}

/**
 * Check if the block is a bookmark block
 */
function isBookmarkBlock(element: Element): boolean {
    return element.querySelector('.bookmark-block') !== null ||
        element.querySelector('[data-content-type="bookmark"]') !== null;
}

/**
 * Create a compact preview for bookmark blocks with image thumbnail
 */
function createBookmarkPreview(blockElement: Element, isDark: boolean): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay bn-drag-overlay-bookmark';
    overlay.id = 'bn-custom-drag-overlay';

    const bookmarkCard = blockElement.querySelector('.bookmark-card');
    if (!bookmarkCard) {
        // Fallback: show a simple bookmark icon
        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span style="opacity: 0.7;">Bookmark</span>
            </div>
        `;
    } else {
        // Extract key info for compact preview
        const title = bookmarkCard.querySelector('.bookmark-title')?.textContent || '';
        const domain = bookmarkCard.querySelector('.bookmark-domain')?.textContent || '';
        const faviconEl = bookmarkCard.querySelector('.bookmark-favicon') as HTMLImageElement | null;
        const faviconSrc = faviconEl?.src || '';

        // Get the OG image if available
        const imageEl = bookmarkCard.querySelector('.bookmark-image img') as HTMLImageElement | null;
        const imageSrc = imageEl?.src || '';

        // Build the preview with optional image thumbnail
        const imageHtml = imageSrc ? `
            <div style="
                width: 64px;
                height: 48px;
                flex-shrink: 0;
                border-radius: 6px;
                overflow: hidden;
                background: ${isDark ? '#333' : '#f0f0f0'};
            ">
                <img src="${imageSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'" />
            </div>
        ` : '';

        const faviconHtml = faviconSrc
            ? `<img src="${faviconSrc}" style="width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;" onerror="this.style.display='none'" />`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; opacity: 0.5;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>`;

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; max-width: 320px;">
                ${imageHtml}
                <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 500; font-size: 13px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(title)}</div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${faviconHtml}
                        <span style="font-size: 11px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(domain)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    overlay.style.cssText = `
        position: fixed;
        z-index: 99999;
        padding: 10px 14px;
        background: ${isDark ? 'rgba(45, 45, 45, 0.98)' : 'rgba(255, 255, 255, 0.98)'};
        border: 1px solid ${isDark ? '#505050' : '#e0e0e0'};
        border-radius: 10px;
        box-shadow: 0 8px 32px ${isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)'}, 0 2px 8px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.08)'};
        pointer-events: none;
        color: ${isDark ? '#e5e5e5' : '#333333'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        opacity: 0;
        transition: opacity 0.15s ease-out;
        transform: scale(1.02);
    `;

    return overlay;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create the overlay element showing block preview
 */
function createOverlay(blockElement: Element): HTMLDivElement | null {
    // Detect theme - check for app's theme class on .app-container
    const appContainer = document.querySelector('.app-container');
    const isDark = appContainer?.classList.contains('dark')
        || document.documentElement.classList.contains('dark')
        || document.body.classList.contains('dark')
        || document.documentElement.getAttribute('data-color-scheme') === 'dark'
        || document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';

    // Special handling for bookmark blocks
    if (isBookmarkBlock(blockElement)) {
        return createBookmarkPreview(blockElement, isDark);
    }

    const blockContent = blockElement.querySelector('.bn-block-content')
        || blockElement.querySelector('[data-content-type]')
        || blockElement;

    if (!blockContent) return null;

    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay';
    overlay.id = 'bn-custom-drag-overlay';

    overlay.style.cssText = `
        position: fixed;
        z-index: 99999;
        padding: 10px 14px;
        background: ${isDark ? 'rgba(45, 45, 45, 0.98)' : 'rgba(255, 255, 255, 0.98)'};
        border: 1px solid ${isDark ? '#505050' : '#e0e0e0'};
        border-radius: 10px;
        box-shadow: 0 8px 32px ${isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)'}, 0 2px 8px ${isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.08)'};
        max-width: 350px;
        max-height: 120px;
        overflow: hidden;
        pointer-events: none;
        color: ${isDark ? '#e5e5e5' : '#333333'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        opacity: 0;
        transition: opacity 0.15s ease-out;
        transform: scale(1.02);
    `;

    // Clone content
    const clone = blockContent.cloneNode(true) as HTMLElement;

    // Remove interactive elements and action buttons
    clone.querySelectorAll('button, input, textarea, .bn-side-menu, [data-drag-handle], .bookmark-actions').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => {
        (el as HTMLElement).contentEditable = 'false';
    });

    // Reset styles on clone
    clone.style.pointerEvents = 'none';
    clone.style.userSelect = 'none';
    clone.style.margin = '0';

    // For images in the clone, ensure they display correctly
    clone.querySelectorAll('img').forEach(img => {
        img.style.maxWidth = '100%';
        img.style.maxHeight = '80px';
        img.style.objectFit = 'contain';
    });

    overlay.appendChild(clone);

    return overlay;
}

export default useDragPreviewFix;
