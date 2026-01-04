import { useState, useRef, useEffect } from 'react';
import { Block } from '@blocknote/core';

interface UseContentTransitionOptions {
    activeId: string | null;
    isExternalMode: boolean;
    loadContent: (id: string) => Promise<Block[] | undefined>;
}

export function useContentTransition({
    activeId,
    isExternalMode,
    loadContent,
}: UseContentTransitionOptions) {
    const [content, setContent] = useState<Block[] | undefined>(undefined);
    const [contentLoading, setContentLoading] = useState(false);
    const [editorAnimating, setEditorAnimating] = useState(false);
    const [editorKey, setEditorKey] = useState<string | null>(null);
    const loadingIdRef = useRef(0);

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
    };
}
