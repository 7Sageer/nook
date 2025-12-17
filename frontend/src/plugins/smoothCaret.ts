import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

interface SmoothCaretState {
    cursorElement: HTMLDivElement | null;
    lastPos: { top: number; left: number; height: number } | null;
    isBlinking: boolean;
    blinkTimeout: number | null;
}

/**
 * Creates a smooth caret plugin for ProseMirror/BlockNote
 * This plugin creates a virtual cursor that animates smoothly between positions
 */
export function createSmoothCaretPlugin(options?: {
    /** Transition duration in ms, default: 50 */
    transitionDuration?: number;
    /** Cursor color, default: uses CSS variable */
    cursorColor?: string;
    /** Cursor width in px, default: 2 */
    cursorWidth?: number;
    /** Enable blinking animation, default: true */
    enableBlink?: boolean;
}) {
    const {
        transitionDuration = 50,
        cursorColor,
        cursorWidth = 2,
        enableBlink = true,
    } = options || {};

    let state: SmoothCaretState = {
        cursorElement: null,
        lastPos: null,
        isBlinking: false,
        blinkTimeout: null,
    };

    function createCursorElement(): HTMLDivElement {
        const cursor = document.createElement('div');
        cursor.className = 'smooth-caret';
        cursor.setAttribute('data-smooth-caret', 'true');

        // Base styles
        Object.assign(cursor.style, {
            position: 'absolute',
            width: `${cursorWidth}px`,
            backgroundColor: cursorColor || 'var(--smooth-caret-color, #2563eb)',
            pointerEvents: 'none',
            zIndex: '1000',
            borderRadius: '1px',
            transition: `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 150ms ease`,
            opacity: '0',
        });

        return cursor;
    }

    function updateCursorPosition(view: EditorView) {
        if (!state.cursorElement) return;

        const { selection } = view.state;

        // Only show cursor for collapsed selections (no text selected)
        if (!selection.empty) {
            state.cursorElement.style.opacity = '0';
            return;
        }

        // Get cursor coordinates
        const coords = view.coordsAtPos(selection.from);

        // Get editor's bounding rect for relative positioning
        const editorRect = view.dom.getBoundingClientRect();
        const scrollTop = view.dom.scrollTop || 0;
        const scrollLeft = view.dom.scrollLeft || 0;

        const top = coords.top - editorRect.top + scrollTop;
        const left = coords.left - editorRect.left + scrollLeft;
        const height = coords.bottom - coords.top;

        // Check if position changed significantly
        const posChanged = !state.lastPos ||
            Math.abs(state.lastPos.top - top) > 1 ||
            Math.abs(state.lastPos.left - left) > 1 ||
            Math.abs(state.lastPos.height - height) > 1;

        if (posChanged) {
            // If this is a large jump (e.g., clicking to a new position), disable transition temporarily
            const isLargeJump = state.lastPos && (
                Math.abs(state.lastPos.top - top) > 100 ||
                Math.abs(state.lastPos.left - left) > 200
            );

            if (isLargeJump) {
                state.cursorElement.style.transition = 'none';
                // Force reflow
                state.cursorElement.offsetHeight;
            }

            state.cursorElement.style.top = `${top}px`;
            state.cursorElement.style.left = `${left}px`;
            state.cursorElement.style.height = `${height}px`;
            state.cursorElement.style.opacity = '1';

            if (isLargeJump) {
                // Restore transition after the position is set
                requestAnimationFrame(() => {
                    if (state.cursorElement) {
                        state.cursorElement.style.transition = `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 150ms ease`;
                    }
                });
            }

            state.lastPos = { top, left, height };

            // Reset blink animation on movement
            if (enableBlink) {
                resetBlink();
            }
        }
    }

    function resetBlink() {
        if (!state.cursorElement) return;

        // Stop current blink
        state.cursorElement.classList.remove('smooth-caret-blink');
        state.isBlinking = false;

        // Clear existing timeout
        if (state.blinkTimeout !== null) {
            clearTimeout(state.blinkTimeout);
        }

        // Start blinking after a short delay
        state.blinkTimeout = window.setTimeout(() => {
            if (state.cursorElement) {
                state.cursorElement.classList.add('smooth-caret-blink');
                state.isBlinking = true;
            }
        }, 530);
    }

    function handleFocus(view: EditorView) {
        if (state.cursorElement) {
            state.cursorElement.style.opacity = '1';
            updateCursorPosition(view);
        }
    }

    function handleBlur() {
        if (state.cursorElement) {
            state.cursorElement.style.opacity = '0';
            state.cursorElement.classList.remove('smooth-caret-blink');
        }
    }

    return new Plugin({
        // No key - allows multiple instances for different editors

        view(editorView: EditorView) {
            // Create cursor element
            state.cursorElement = createCursorElement();

            // Append to editor's parent (so it can be positioned relative to editor)
            const editorWrapper = editorView.dom.parentElement;
            if (editorWrapper) {
                // Ensure wrapper has relative positioning
                const wrapperStyle = window.getComputedStyle(editorWrapper);
                if (wrapperStyle.position === 'static') {
                    editorWrapper.style.position = 'relative';
                }
                editorWrapper.appendChild(state.cursorElement);
            }

            // Add class to hide native caret
            editorView.dom.classList.add('smooth-caret-enabled');

            // Initial position update
            setTimeout(() => updateCursorPosition(editorView), 0);

            // Event listeners
            editorView.dom.addEventListener('focus', () => handleFocus(editorView));
            editorView.dom.addEventListener('blur', handleBlur);

            return {
                update(view: EditorView) {
                    updateCursorPosition(view);
                },
                destroy() {
                    // Cleanup
                    if (state.cursorElement && state.cursorElement.parentElement) {
                        state.cursorElement.parentElement.removeChild(state.cursorElement);
                    }
                    if (state.blinkTimeout !== null) {
                        clearTimeout(state.blinkTimeout);
                    }
                    editorView.dom.classList.remove('smooth-caret-enabled');
                    state = {
                        cursorElement: null,
                        lastPos: null,
                        isBlinking: false,
                        blinkTimeout: null,
                    };
                },
            };
        },
    });
}

export default createSmoothCaretPlugin;
