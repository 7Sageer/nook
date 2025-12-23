import { useEffect, useRef } from "react";

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
    const isDraggingRef = useRef(false);

    useEffect(() => {
        console.log('[DragFix] Hook initialized');

        let mouseX = 0;
        let mouseY = 0;

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
            console.log('[DragFix] dragstart event fired');
            console.log('[DragFix] target:', e.target);
            console.log('[DragFix] dataTransfer:', e.dataTransfer);

            const target = e.target as HTMLElement;

            // Check if this is a BlockNote drag handle (using data-test attribute from the SVG)
            const dragHandle = target.closest('[draggable="true"]');
            console.log('[DragFix] dragHandle found:', dragHandle);

            if (!dragHandle) {
                console.log('[DragFix] No draggable element found, skipping');
                return;
            }

            // Make sure we're in the BlockNote editor
            const editorWrapper = target.closest('.bn-editor');
            console.log('[DragFix] editorWrapper:', editorWrapper);

            if (!editorWrapper) {
                console.log('[DragFix] Not in BlockNote editor, skipping');
                return;
            }

            // Find the hovered block
            const hoveredBlock = findHoveredBlock(target);
            console.log('[DragFix] hoveredBlock:', hoveredBlock);

            if (!hoveredBlock) {
                console.log('[DragFix] No block found, skipping');
                return;
            }

            // Create and show the custom overlay
            const overlay = createOverlay(hoveredBlock);
            console.log('[DragFix] overlay created:', overlay);

            if (overlay) {
                overlay.style.left = `${mouseX + 15}px`;
                overlay.style.top = `${mouseY + 15}px`;
                document.body.appendChild(overlay);
                overlayRef.current = overlay;
                isDraggingRef.current = true;

                console.log('[DragFix] Overlay added to DOM');

                // Make the native ghost image transparent
                // Create a 1x1 transparent image
                const transparentImg = new Image();
                transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

                if (e.dataTransfer) {
                    try {
                        e.dataTransfer.setDragImage(transparentImg, 0, 0);
                        console.log('[DragFix] setDragImage called with transparent image');
                    } catch (err) {
                        console.error('[DragFix] setDragImage error:', err);
                    }
                } else {
                    console.log('[DragFix] dataTransfer is null');
                }
            }
        };

        /**
         * Handle drag end - remove overlay
         */
        const handleDragEnd = () => {
            console.log('[DragFix] dragend/drop event');
            if (overlayRef.current) {
                overlayRef.current.remove();
                overlayRef.current = null;
                console.log('[DragFix] Overlay removed');
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

        // Use capture phase to intercept events early
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('dragstart', handleDragStart, true);
        document.addEventListener('drag', handleDrag, true);
        document.addEventListener('dragend', handleDragEnd, true);
        document.addEventListener('drop', handleDragEnd, true);

        console.log('[DragFix] Event listeners registered');

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('dragstart', handleDragStart, true);
            document.removeEventListener('drag', handleDrag, true);
            document.removeEventListener('dragend', handleDragEnd, true);
            document.removeEventListener('drop', handleDragEnd, true);

            if (overlayRef.current) {
                overlayRef.current.remove();
                overlayRef.current = null;
            }
            console.log('[DragFix] Cleanup complete');
        };
    }, []);
}

/**
 * Find the block element being dragged
 */
function findHoveredBlock(target: HTMLElement): Element | null {
    // Method 1: BlockNote marks hovered blocks
    const hoveredBlock = document.querySelector('.bn-block-outer[data-is-hovered="true"]');
    console.log('[DragFix] findHoveredBlock - Method 1 (data-is-hovered):', hoveredBlock);
    if (hoveredBlock) return hoveredBlock;

    // Method 2: Find by side menu position
    const sideMenu = target.closest('.bn-side-menu');
    console.log('[DragFix] findHoveredBlock - sideMenu:', sideMenu);
    if (sideMenu) {
        const menuRect = sideMenu.getBoundingClientRect();
        const blocks = document.querySelectorAll('.bn-block-outer');
        console.log('[DragFix] findHoveredBlock - blocks count:', blocks.length);
        for (const block of blocks) {
            const blockRect = block.getBoundingClientRect();
            if (menuRect.top >= blockRect.top - 10 && menuRect.top <= blockRect.bottom + 10) {
                console.log('[DragFix] findHoveredBlock - Method 2 found:', block);
                return block;
            }
        }
    }

    // Method 3: Closest block outer
    const closest = target.closest('.bn-block-outer');
    console.log('[DragFix] findHoveredBlock - Method 3 (closest):', closest);
    return closest;
}

/**
 * Create the overlay element showing block preview
 */
function createOverlay(blockElement: Element): HTMLDivElement | null {
    const blockContent = blockElement.querySelector('.bn-block-content')
        || blockElement.querySelector('[data-content-type]')
        || blockElement;

    console.log('[DragFix] createOverlay - blockContent:', blockContent);

    if (!blockContent) return null;

    const overlay = document.createElement('div');
    overlay.className = 'bn-drag-overlay';
    overlay.id = 'bn-custom-drag-overlay';

    // Detect theme
    const isDark = document.documentElement.classList.contains('dark')
        || document.body.classList.contains('dark')
        || document.documentElement.getAttribute('data-color-scheme') === 'dark'
        || document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';

    console.log('[DragFix] createOverlay - isDark:', isDark);

    overlay.style.cssText = `
    position: fixed;
    z-index: 99999;
    padding: 10px 14px;
    background: ${isDark ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    border: 1px solid ${isDark ? '#404040' : '#e0e0e0'};
    border-radius: 8px;
    box-shadow: 0 8px 24px ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.18)'};
    max-width: 350px;
    max-height: 150px;
    overflow: hidden;
    pointer-events: none;
    color: ${isDark ? '#e0e0e0' : '#333333'};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  `;

    // Clone content
    const clone = blockContent.cloneNode(true) as HTMLElement;

    // Remove interactive elements
    clone.querySelectorAll('button, input, textarea, .bn-side-menu, [data-drag-handle]').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => {
        (el as HTMLElement).contentEditable = 'false';
    });

    // Reset styles
    clone.style.pointerEvents = 'none';
    clone.style.userSelect = 'none';

    overlay.appendChild(clone);

    return overlay;
}

export default useDragPreviewFix;
