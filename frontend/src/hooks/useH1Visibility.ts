import { useState, useEffect, useCallback } from 'react';

/**
 * 监听编辑器中第一个 H1 标题的可见性
 * 当 H1 在视口内时返回 true，滚出视口时返回 false
 * @param editorKey - 编辑器的 key，用于在编辑器切换后重新观察
 * @param activeId - 当前活动文档 ID，用于在切换时立即重置状态
 */
export function useH1Visibility(editorKey: string | null, activeId: string | null) {
  const [isH1Visible, setIsH1Visible] = useState(true);

  const observeH1 = useCallback(() => {
    // 查找编辑器容器内的第一个 H1
    const editorContainer = document.querySelector('.editor-container');
    // 滚动容器现在是 main-content
    const scrollContainer = document.querySelector('.main-content');
    if (!editorContainer || !scrollContainer) return { cleanup: () => { } };

    const createIntersectionObserver = (h1Element: Element) => {
      // 使用 IntersectionObserver 监听 H1 可见性
      return new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // 当 H1 的任何部分可见时，隐藏顶栏标题
            setIsH1Visible(entry.isIntersecting);
          });
        },
        {
          root: scrollContainer,
          threshold: 0,
          rootMargin: '0px 0px 0px 0px',
        }
      );
    };

    const h1Element = editorContainer.querySelector('h1');
    if (h1Element) {
      // H1 已存在，直接观察
      const observer = createIntersectionObserver(h1Element);
      observer.observe(h1Element);
      return { cleanup: () => observer.disconnect() };
    }

    // H1 不存在，使用 MutationObserver 等待 H1 出现
    let intersectionObserver: IntersectionObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const mutationObserver = new MutationObserver(() => {
      const h1 = editorContainer.querySelector('h1');
      if (h1) {
        // H1 出现了，停止监听 DOM 变化，开始监听 H1 可见性
        mutationObserver.disconnect();
        if (timeoutId) clearTimeout(timeoutId);
        intersectionObserver = createIntersectionObserver(h1);
        intersectionObserver.observe(h1);
      }
    });

    mutationObserver.observe(editorContainer, {
      childList: true,
      subtree: true,
    });

    // 超时后如果仍然没有 H1，才显示顶栏标题
    timeoutId = setTimeout(() => {
      if (!editorContainer.querySelector('h1')) {
        setIsH1Visible(false);
        mutationObserver.disconnect();
      }
    }, 500);

    return {
      cleanup: () => {
        mutationObserver.disconnect();
        intersectionObserver?.disconnect();
        if (timeoutId) clearTimeout(timeoutId);
      },
    };
  }, []);

  // activeId 变化时先显示顶栏，延迟后再开始检测 H1
  useEffect(() => {
    // 切换文档时先显示顶栏（isH1Visible = false 表示 H1 不可见，显示顶栏）
    setIsH1Visible(false);
  }, [activeId]);

  // editorKey 变化后开始观察 H1
  useEffect(() => {
    if (!editorKey) {
      return;
    }

    let observerResult: { cleanup: () => void } | null = null;

    // 延迟 1.5 秒后再开始观察 H1，让用户先看到顶栏标题
    const timeoutId = setTimeout(() => {
      observerResult = observeH1();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      observerResult?.cleanup();
    };
  }, [editorKey, observeH1]);

  return { isH1Visible };
}
