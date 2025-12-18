import { useState, useRef, useCallback, useEffect, MutableRefObject } from 'react';
import { Block, BlockNoteEditor } from '@blocknote/core';

interface UseEditorOptions {
    isExternalMode: boolean;
    activeId: string | null;
    loadContent: (id: string) => Promise<Block[] | undefined>;
}

interface UseEditorReturn {
    content: Block[] | undefined;
    setContent: React.Dispatch<React.SetStateAction<Block[] | undefined>>;
    contentLoading: boolean;
    setContentLoading: React.Dispatch<React.SetStateAction<boolean>>;
    editorAnimating: boolean;
    editorKey: string | null;
    setEditorKey: React.Dispatch<React.SetStateAction<string | null>>;
    editorRef: MutableRefObject<BlockNoteEditor | null>;
    parseMarkdownToBlocks: (markdownText: string) => Promise<Block[]>;
}

/**
 * Hook for managing editor state including content, loading states, and animations.
 */
export function useEditor({
    isExternalMode,
    activeId,
    loadContent,
}: UseEditorOptions): UseEditorReturn {
    const [content, setContent] = useState<Block[] | undefined>(undefined);
    const [contentLoading, setContentLoading] = useState(false);
    const [editorAnimating, setEditorAnimating] = useState(false);
    const [editorKey, setEditorKey] = useState<string | null>(null);
    const editorRef = useRef<BlockNoteEditor | null>(null);
    const loadingIdRef = useRef(0);

    const parseMarkdownToBlocks = useCallback(async (markdownText: string) => {
        const editor = editorRef.current ?? BlockNoteEditor.create();
        return editor.tryParseMarkdownToBlocks(markdownText);
    }, []);

    // 加载当前文档内容（带动画）
    useEffect(() => {
        // 如果是外部文件模式，跳过内部文档加载，并使任何在途的内部加载失效
        if (isExternalMode) {
            loadingIdRef.current += 1;
            setEditorAnimating(false);
            return;
        }

        if (!activeId) {
            loadingIdRef.current += 1;
            setContent(undefined);
            setEditorKey(null);
            setContentLoading(false);
            setEditorAnimating(false);
            return;
        }

        const currentId = activeId;
        const needsLoad = !editorKey || editorKey !== currentId;
        const shouldAnimate = Boolean(editorKey && editorKey !== currentId);

        if (!needsLoad) {
            setContentLoading(false);
            setEditorAnimating(false);
            return;
        }

        const currentLoadingId = ++loadingIdRef.current;

        // 退出动画时长（与 CSS 中的 editor-fade-exit 动画时长匹配）
        const EXIT_ANIMATION_DURATION = 80;

        const doLoad = () => {
            loadContent(currentId)
                .then((data) => {
                    if (currentLoadingId !== loadingIdRef.current) return;
                    setContent(data);
                    setEditorKey(currentId);
                })
                .catch((err) => {
                    console.error('Failed to load content:', err);
                })
                .finally(() => {
                    if (currentLoadingId !== loadingIdRef.current) return;
                    setContentLoading(false);
                    setEditorAnimating(false);
                });
        };

        if (shouldAnimate) {
            // 有动画时：先播放退出动画，保持旧编辑器显示
            setEditorAnimating(true);
            setTimeout(doLoad, EXIT_ANIMATION_DURATION);
        } else {
            // 无动画时（首次加载）：显示 loading 状态
            setContentLoading(true);
            doLoad();
        }
    }, [activeId, editorKey, isExternalMode, loadContent]);

    return {
        content,
        setContent,
        contentLoading,
        setContentLoading,
        editorAnimating,
        editorKey,
        setEditorKey,
        editorRef,
        parseMarkdownToBlocks,
    };
}
