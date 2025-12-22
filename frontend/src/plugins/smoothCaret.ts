import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

interface SmoothCaretState {
    cursorElement: HTMLDivElement | null;
    selectionElements: HTMLDivElement[];
    lastPos: { top: number; left: number; height: number } | null;
    lastSelectionRects: DOMRect[];
    isBlinking: boolean;
    blinkTimeout: number | null;
}

/**
 * Creates a smooth caret plugin for ProseMirror/BlockNote
 * This plugin creates a virtual cursor that animates smoothly between positions
 * and also renders smooth animated text selection highlighting
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
    /** Selection highlight color, default: uses CSS variable */
    selectionColor?: string;
}) {
    const {
        transitionDuration = 50,
        cursorColor,
        cursorWidth = 2,
        enableBlink = true,
        selectionColor,
    } = options || {};

    let state: SmoothCaretState = {
        cursorElement: null,
        selectionElements: [],
        lastPos: null,
        lastSelectionRects: [],
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

    function createSelectionElement(): HTMLDivElement {
        const rect = document.createElement('div');
        rect.className = 'smooth-selection-rect';
        rect.setAttribute('data-smooth-selection', 'true');

        Object.assign(rect.style, {
            position: 'absolute',
            backgroundColor: selectionColor || 'var(--smooth-selection-color, rgba(37, 99, 235, 0.25))',
            pointerEvents: 'none',
            zIndex: '999',
            borderRadius: '2px',
            transition: `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, width ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 100ms ease`,
            opacity: '0',
        });

        return rect;
    }

    function getSelectionRects(view: EditorView): DOMRect[] {
        const { selection } = view.state;
        if (selection.empty) return [];

        try {
            // Get DOM range from ProseMirror selection
            const fromDOM = view.domAtPos(selection.from);
            const toDOM = view.domAtPos(selection.to);

            const range = document.createRange();
            range.setStart(fromDOM.node, fromDOM.offset);
            range.setEnd(toDOM.node, toDOM.offset);

            // Get all client rects for the range
            const rects = Array.from(range.getClientRects());

            // Filter out zero-size rects and merge adjacent ones
            return rects.filter(rect => rect.width > 0 && rect.height > 0);
        } catch (e) {
            // Fallback: use simple bounding rect approach
            return [];
        }
    }

    function rectsAreEqual(a: DOMRect[], b: DOMRect[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (Math.abs(a[i].top - b[i].top) > 1 ||
                Math.abs(a[i].left - b[i].left) > 1 ||
                Math.abs(a[i].width - b[i].width) > 1 ||
                Math.abs(a[i].height - b[i].height) > 1) {
                return false;
            }
        }
        return true;
    }

    function updateSelectionHighlight(view: EditorView, editorWrapper: HTMLElement | null) {
        if (!editorWrapper) return;

        const { selection } = view.state;
        const editorRect = view.dom.getBoundingClientRect();
        const scrollTop = view.dom.scrollTop || 0;
        const scrollLeft = view.dom.scrollLeft || 0;

        // Get selection rectangles
        const rects = getSelectionRects(view);

        // Check if selection changed significantly
        if (rectsAreEqual(rects, state.lastSelectionRects)) {
            return;
        }

        // Check if this is a large jump (should skip animation)
        const isLargeChange = state.lastSelectionRects.length !== rects.length ||
            (rects.length > 0 && state.lastSelectionRects.length > 0 &&
                Math.abs(rects[0].top - state.lastSelectionRects[0].top) > 100);

        // Ensure we have enough selection elements
        while (state.selectionElements.length < rects.length) {
            const elem = createSelectionElement();
            editorWrapper.appendChild(elem);
            state.selectionElements.push(elem);
        }

        // Update or hide selection elements
        for (let i = 0; i < state.selectionElements.length; i++) {
            const elem = state.selectionElements[i];

            if (i < rects.length) {
                const rect = rects[i];
                const top = rect.top - editorRect.top + scrollTop;
                const left = rect.left - editorRect.left + scrollLeft;

                if (isLargeChange) {
                    elem.style.transition = 'none';
                    // Force reflow
                    elem.offsetHeight;
                }

                elem.style.top = `${top}px`;
                elem.style.left = `${left}px`;
                elem.style.width = `${rect.width}px`;
                elem.style.height = `${rect.height}px`;
                elem.style.opacity = '1';

                if (isLargeChange) {
                    requestAnimationFrame(() => {
                        elem.style.transition = `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, width ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 100ms ease`;
                    });
                }
            } else {
                // Hide unused elements
                elem.style.opacity = '0';
            }
        }

        state.lastSelectionRects = rects;
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

    function handleFocus(view: EditorView, editorWrapper: HTMLElement | null) {
        if (state.cursorElement) {
            state.cursorElement.style.opacity = '1';
            updateCursorPosition(view);
        }
        updateSelectionHighlight(view, editorWrapper);
    }

    function handleBlur() {
        if (state.cursorElement) {
            state.cursorElement.style.opacity = '0';
            state.cursorElement.classList.remove('smooth-caret-blink');
        }
        // Hide all selection elements
        state.selectionElements.forEach(elem => {
            elem.style.opacity = '0';
        });
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

            // Add class to hide native caret and selection
            editorView.dom.classList.add('smooth-caret-enabled');

            // Initial position update
            setTimeout(() => {
                updateCursorPosition(editorView);
                updateSelectionHighlight(editorView, editorWrapper);
            }, 0);

            // Event listeners
            editorView.dom.addEventListener('focus', () => handleFocus(editorView, editorWrapper));
            editorView.dom.addEventListener('blur', handleBlur);

            return {
                update(view: EditorView) {
                    updateCursorPosition(view);
                    updateSelectionHighlight(view, editorWrapper);
                },
                destroy() {
                    // Cleanup cursor
                    if (state.cursorElement && state.cursorElement.parentElement) {
                        state.cursorElement.parentElement.removeChild(state.cursorElement);
                    }
                    // Cleanup selection elements
                    state.selectionElements.forEach(elem => {
                        if (elem.parentElement) {
                            elem.parentElement.removeChild(elem);
                        }
                    });
                    if (state.blinkTimeout !== null) {
                        clearTimeout(state.blinkTimeout);
                    }
                    editorView.dom.classList.remove('smooth-caret-enabled');
                    state = {
                        cursorElement: null,
                        selectionElements: [],
                        lastPos: null,
                        lastSelectionRects: [],
                        isBlinking: false,
                        blinkTimeout: null,
                    };
                },
            };
        },
    });
}

export default createSmoothCaretPlugin;
