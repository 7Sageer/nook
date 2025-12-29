import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

interface SmoothCaretState {
    cursorElement: HTMLDivElement | null;
    selectionElements: HTMLDivElement[];
    lastPos: { top: number; left: number; height: number } | null;
    lastSelectionRects: DOMRect[];
    lastSelectionIsBackward: boolean | null;
    isBlinking: boolean;
    blinkTimeout: number | null;
    isComposing: boolean;
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
        lastSelectionIsBackward: null,
        isBlinking: false,
        blinkTimeout: null,
        isComposing: false,
    };

    function isNativeTextInputFocused(view: EditorView): boolean {
        const activeElement = view.dom.ownerDocument.activeElement as HTMLElement | null;
        if (!activeElement) return false;
        if (!view.dom.contains(activeElement)) return false;
        const tag = activeElement.tagName;
        return tag === "INPUT" || tag === "TEXTAREA";
    }

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

    /**
     * Merge overlapping or adjacent rectangles to prevent duplicate highlights
     */
    function mergeRects(rects: DOMRect[]): DOMRect[] {
        if (rects.length === 0) return [];

        // Group rectangles by their vertical position (same row = similar top value)
        const rowTolerance = 3; // pixels tolerance for same-row detection
        const rows: DOMRect[][] = [];

        for (const rect of rects) {
            // Find existing row that matches this rect's vertical position
            let foundRow = false;
            for (const row of rows) {
                if (Math.abs(row[0].top - rect.top) <= rowTolerance &&
                    Math.abs(row[0].height - rect.height) <= rowTolerance) {
                    row.push(rect);
                    foundRow = true;
                    break;
                }
            }
            if (!foundRow) {
                rows.push([rect]);
            }
        }

        // Merge rectangles within each row
        const merged: DOMRect[] = [];
        for (const row of rows) {
            // Sort by left position
            row.sort((a, b) => a.left - b.left);

            let current = row[0];
            for (let i = 1; i < row.length; i++) {
                const next = row[i];
                // Check if rectangles overlap or are adjacent (within 2px)
                if (next.left <= current.right + 2) {
                    // Merge: extend current rect to include next
                    const newRight = Math.max(current.right, next.right);
                    const newTop = Math.min(current.top, next.top);
                    const newBottom = Math.max(current.bottom, next.bottom);
                    current = new DOMRect(
                        current.left,
                        newTop,
                        newRight - current.left,
                        newBottom - newTop
                    );
                } else {
                    // No overlap, push current and start new
                    merged.push(current);
                    current = next;
                }
            }
            merged.push(current);
        }

        return merged;
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

            // Collect rects only from text nodes to avoid block-level element boundaries
            const allRects: DOMRect[] = [];

            // Use TreeWalker to iterate through text nodes in the range
            const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // Check if this text node is within our selection range
                        const nodeRange = document.createRange();
                        nodeRange.selectNodeContents(node);

                        // Check if ranges intersect
                        const startsBeforeEnd = nodeRange.compareBoundaryPoints(Range.START_TO_END, range) >= 0;
                        const endsAfterStart = nodeRange.compareBoundaryPoints(Range.END_TO_START, range) <= 0;

                        return (startsBeforeEnd && endsAfterStart)
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            let textNode = walker.nextNode() as Text | null;
            while (textNode) {
                // Create a range for the portion of this text node within selection
                const textRange = document.createRange();

                if (textNode === fromDOM.node) {
                    textRange.setStart(textNode, fromDOM.offset);
                } else {
                    textRange.setStart(textNode, 0);
                }

                if (textNode === toDOM.node) {
                    textRange.setEnd(textNode, toDOM.offset);
                } else {
                    textRange.setEnd(textNode, textNode.length);
                }

                // Get rects for this text portion
                const rects = textRange.getClientRects();
                for (let i = 0; i < rects.length; i++) {
                    if (rects[i].width > 0 && rects[i].height > 0) {
                        allRects.push(rects[i]);
                    }
                }

                textNode = walker.nextNode() as Text | null;
            }

            // If TreeWalker approach didn't get any rects, fallback to original method
            if (allRects.length === 0) {
                const fallbackRects = Array.from(range.getClientRects())
                    .filter(rect => rect.width > 0 && rect.height > 0);
                return mergeRects(fallbackRects);
            }

            // Merge overlapping rectangles
            return mergeRects(allRects);
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

    function sortRectsForDirection(rects: DOMRect[], isBackward: boolean): DOMRect[] {
        const rowTolerance = 1; // px tolerance to treat rects as same row
        return [...rects].sort((a, b) => {
            if (Math.abs(a.top - b.top) > rowTolerance) {
                return isBackward ? b.top - a.top : a.top - b.top;
            }
            return isBackward ? b.left - a.left : a.left - b.left;
        });
    }

    function updateSelectionHighlight(view: EditorView, editorWrapper: HTMLElement | null) {
        if (!editorWrapper) return;

        // Skip selection updates during IME composition to prevent flickering
        if (state.isComposing) {
            return;
        }

        if (!view.hasFocus() || isNativeTextInputFocused(view)) {
            // Ensure selection decorations don't remain visible while focus is in a native input.
            state.selectionElements.forEach((elem) => {
                elem.style.opacity = '0';
            });
            return;
        }

        const { selection } = view.state;
        const editorRect = view.dom.getBoundingClientRect();
        const scrollTop = view.dom.scrollTop || 0;
        const scrollLeft = view.dom.scrollLeft || 0;

        const isBackwardSelection = selection.anchor > selection.head;

        // Get selection rectangles
        const rects = sortRectsForDirection(getSelectionRects(view), isBackwardSelection);

        const directionChanged = state.lastSelectionIsBackward !== null &&
            state.lastSelectionIsBackward !== isBackwardSelection;

        // Check if selection changed significantly
        if (!directionChanged && rectsAreEqual(rects, state.lastSelectionRects)) {
            return;
        }

        // Detect if this is a brand new selection (from no selection to having selection)
        const isNewSelection = state.lastSelectionRects.length === 0 && rects.length > 0;

        // Only skip animation for truly large jumps (e.g., clicking to a completely different position)
        // NOT for normal multi-line selection expansion
        const isLargeJump = !directionChanged && rects.length > 0 && state.lastSelectionRects.length > 0 &&
            Math.abs(rects[0].top - state.lastSelectionRects[0].top) > 400;

        // Ensure we have enough selection elements
        while (state.selectionElements.length < rects.length) {
            const elem = createSelectionElement();
            editorWrapper.appendChild(elem);
            state.selectionElements.push(elem);
        }

        // Update or hide selection elements
        for (let i = 0; i < state.selectionElements.length; i++) {
            const elem = state.selectionElements[i];
            // For expansion: new elements appearing beyond existing ones
            const isExpansionNewElement = directionChanged || i >= state.lastSelectionRects.length;

            if (i < rects.length) {
                const rect = rects[i];
                const top = rect.top - editorRect.top + scrollTop;
                const left = rect.left - editorRect.left + scrollLeft;

                // For brand new selection: animate from cursor position
                if (isNewSelection && state.lastPos) {
                    // Position at cursor first (no transition)
                    elem.style.transition = 'none';
                    elem.style.top = `${state.lastPos.top}px`;
                    elem.style.left = `${state.lastPos.left}px`;
                    elem.style.width = '0px';
                    elem.style.height = `${state.lastPos.height}px`;
                    elem.style.opacity = '1';
                    // Force reflow
                    elem.offsetHeight;
                    // Then animate to target position
                    elem.style.transition = `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, width ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 100ms ease`;
                    elem.style.top = `${top}px`;
                    elem.style.left = `${left}px`;
                    elem.style.width = `${rect.width}px`;
                    elem.style.height = `${rect.height}px`;
                } else if (isLargeJump || (isExpansionNewElement && !isNewSelection)) {
                    // Skip animation for large jumps OR for expansion new elements
                    elem.style.transition = 'none';
                    // Force reflow
                    elem.offsetHeight;
                    elem.style.top = `${top}px`;
                    elem.style.left = `${left}px`;
                    elem.style.width = `${rect.width}px`;
                    elem.style.height = `${rect.height}px`;
                    elem.style.opacity = '1';
                    requestAnimationFrame(() => {
                        elem.style.transition = `top ${transitionDuration}ms ease-out, left ${transitionDuration}ms ease-out, width ${transitionDuration}ms ease-out, height ${transitionDuration}ms ease-out, opacity 100ms ease`;
                    });
                } else {
                    // Normal case: animate smoothly
                    elem.style.top = `${top}px`;
                    elem.style.left = `${left}px`;
                    elem.style.width = `${rect.width}px`;
                    elem.style.height = `${rect.height}px`;
                    elem.style.opacity = '1';
                }
            } else {
                // Hide unused elements with fade out
                elem.style.opacity = '0';
            }
        }

        state.lastSelectionRects = rects;
        state.lastSelectionIsBackward = isBackwardSelection;
    }

    function updateCursorPosition(view: EditorView) {
        if (!state.cursorElement) return;
        if (!view.hasFocus() || isNativeTextInputFocused(view)) {
            state.cursorElement.style.opacity = '0';
            return;
        }

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
                Math.abs(state.lastPos.top - top) > 300 ||
                Math.abs(state.lastPos.left - left) > 400
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

            // Track IME composition state to prevent selection flickering during Chinese/Japanese input
            editorView.dom.addEventListener('compositionstart', () => {
                state.isComposing = true;
            });
            editorView.dom.addEventListener('compositionend', () => {
                // Use setTimeout to ensure compositionend fires after the last input event
                setTimeout(() => {
                    state.isComposing = false;
                    // Trigger selection update after composition ends
                    updateSelectionHighlight(editorView, editorWrapper);
                }, 0);
            });

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
                        lastSelectionIsBackward: null,
                        isBlinking: false,
                        blinkTimeout: null,
                        isComposing: false,
                    };
                },
            };
        },
    });
}

export default createSmoothCaretPlugin;
