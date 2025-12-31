import { useState, useCallback, useEffect, RefObject } from "react";
import { isValidUrl, PasteLinkState } from "../plugins/pasteLink";
import { insertBookmarkWithUrl } from "../utils/editorExtensions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any; // BlockNote editor instance

interface UsePasteHandlerProps {
    editor: EditorInstance;
    containerRef: RefObject<HTMLDivElement>;
}

export const usePasteHandler = ({ editor, containerRef }: UsePasteHandlerProps) => {
    const [pasteLinkState, setPasteLinkState] = useState<PasteLinkState | null>(null);

    // 关闭菜单
    const handleDismissPasteMenu = useCallback(() => {
        setPasteLinkState(null);
    }, []);

    // 粘贴为链接文本
    const handlePasteAsLink = useCallback(() => {
        if (!pasteLinkState || !editor) return;

        editor.insertInlineContent([
            {
                type: "link",
                href: pasteLinkState.url,
                content: pasteLinkState.url,
            },
        ]);

        setPasteLinkState(null);
    }, [pasteLinkState, editor]);

    // 创建书签
    const handleCreateBookmark = useCallback(() => {
        if (!pasteLinkState || !editor) return;

        insertBookmarkWithUrl(editor, pasteLinkState.url);
        setPasteLinkState(null);
    }, [pasteLinkState, editor]);

    // DOM-level paste event listener to capture real clipboard data
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !editor) return;

        const handlePaste = (event: ClipboardEvent) => {
            // Skip if pasting into bookmark input field - let the URL paste directly
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' && target.closest('.bookmark-input')) {
                return;
            }

            const clipboardData = event.clipboardData;
            if (!clipboardData) return;

            const text = clipboardData.getData('text/plain').trim();
            if (!isValidUrl(text)) return;

            // Prevent default paste behavior for URLs
            event.preventDefault();
            event.stopPropagation();

            // Get cursor position from the editor
            try {
                const view = editor._tiptapEditor?.view;
                if (view) {
                    const { from } = view.state.selection;
                    const coords = view.coordsAtPos(from);
                    setPasteLinkState({
                        url: text,
                        position: { x: coords.left, y: coords.bottom + 4 },
                        cursorPos: from,
                    });
                }
            } catch {
                // Fallback: show menu at default position
                setPasteLinkState({
                    url: text,
                    position: { x: 200, y: 200 },
                    cursorPos: 0,
                });
            }
        };

        // Use capture phase to intercept before TipTap processes
        container.addEventListener('paste', handlePaste, { capture: true });

        return () => {
            container.removeEventListener('paste', handlePaste, { capture: true });
        };
    }, [editor, containerRef]);

    return {
        pasteLinkState,
        handleDismissPasteMenu,
        handlePasteAsLink,
        handleCreateBookmark,
    };
};
