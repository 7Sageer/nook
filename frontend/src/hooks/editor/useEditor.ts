import { useState, useRef, useCallback, useEffect, MutableRefObject } from 'react';
import { Block, BlockNoteEditor } from '@blocknote/core';
import { useContentTransition } from '../ui/useContentTransition';

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
    /** 脏标记：用户是否有未保存的更改 */
    isDirty: boolean;
    /** 标记有未保存更改 */
    markDirty: () => void;
    /** 清除脏标记（保存后调用） */
    clearDirty: () => void;
    /** 设置目标块 ID，文档加载后自动滚动到该块 */
    setTargetBlockId: (blockId: string | null) => void;
}

/**
 * Hook for managing editor state including content, loading states, and animations.
 */
export function useEditor({
    isExternalMode,
    activeId,
    loadContent,
}: UseEditorOptions): UseEditorReturn {
    // 脏标记：跟踪用户是否有未保存的更改
    const [isDirty, setIsDirty] = useState(false);

    const editorRef = useRef<BlockNoteEditor | null>(null);

    // 目标块 ID：文档加载后自动滚动到该块
    const [targetBlockId, setTargetBlockId] = useState<string | null>(null);

    const markDirty = useCallback(() => {
        setIsDirty(true);
    }, []);

    const clearDirty = useCallback(() => {
        setIsDirty(false);
    }, []);

    const parseMarkdownToBlocks = useCallback(async (markdownText: string) => {
        const editor = editorRef.current ?? BlockNoteEditor.create();
        return editor.tryParseMarkdownToBlocks(markdownText);
    }, []);

    const {
        content,
        setContent,
        contentLoading,
        setContentLoading,
        editorAnimating,
        editorKey,
        setEditorKey,
    } = useContentTransition({
        activeId,
        isExternalMode,
        loadContent,
    });

    // 滚动到目标块
    useEffect(() => {
        // 等待：有目标块ID、内容加载完成、动画结束、且编辑器已就绪
        if (!targetBlockId || contentLoading || editorAnimating) return;
        // 确保编辑器已经加载了正确的文档（editorKey 匹配 activeId）
        if (!editorKey || editorKey !== activeId) return;

        // 延迟执行，确保编辑器 DOM 已渲染
        const timer = setTimeout(() => {
            // targetBlockId 现在是后端解析好的原始 BlockNote block ID
            // 如果为空字符串（如聚合块），则无法定位
            if (!targetBlockId) return;

            // 尝试通过 data-id 属性查找块元素
            const blockElement = document.querySelector(`[data-id="${targetBlockId}"]`);
            if (blockElement) {
                blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 添加高亮效果
                blockElement.classList.add('highlight-block');
                setTimeout(() => {
                    blockElement.classList.remove('highlight-block');
                }, 2000);
            } else {
                console.warn(`[useEditor] Target block not found: ${targetBlockId}`);
            }

            // 清除目标块 ID
            setTargetBlockId(null);
        }, 150); // 稍微增加延迟以确保 DOM 完全渲染

        return () => clearTimeout(timer);
    }, [targetBlockId, contentLoading, editorAnimating, editorKey, activeId]);

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
        isDirty,
        markDirty,
        clearDirty,
        setTargetBlockId,
    };
}
