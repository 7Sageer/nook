import { useState, useRef, useCallback, useEffect, MutableRefObject } from 'react';
import { Block, BlockNoteEditor } from '@blocknote/core';

interface UseEditorOptions {
    isExternalMode: boolean;
    activeId: string | null;
    loadContent: (id: string) => Promise<Block[]>;
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
        // 如果是外部文件模式，跳过内部文档加载
        if (isExternalMode) return;

        if (activeId) {
            const currentId = activeId;
            const currentLoadingId = ++loadingIdRef.current;

            // 如果已有编辑器，触发淡出动画并同时加载新内容
            if (editorKey && editorKey !== currentId) {
                setEditorAnimating(true);
                setContentLoading(true);
                // 并行：淡出动画和内容加载同时进行
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
            } else if (!editorKey) {
                // 首次加载，直接加载（仅当 editorKey 为 null 时）
                setContentLoading(true);
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
                    });
            }
            // 如果 editorKey === currentId，不做任何事（避免重复加载）
        } else {
            setContent(undefined);
            setEditorKey(null);
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
