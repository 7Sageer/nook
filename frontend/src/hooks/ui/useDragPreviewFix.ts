import { useEffect, useRef } from "react";
import { createOverlay, findHoveredBlock } from "./dragPreviewUtils";

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (window as any).runtime === "undefined") {
            return;
        }

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
            }
        };

        /**
         * Handle drag end - remove overlay
         */
        const handleDragEnd = () => {
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
        };
    }, []);
}

export default useDragPreviewFix;

