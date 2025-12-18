import { useState, useEffect, useCallback } from 'react';

/**
 * 监听编辑器中第一个 H1 标题的可见性
 * 当 H1 在视口内时返回 true，滚出视口时返回 false
 */
export function useH1Visibility(editorKey: string | null) {
  const [isH1Visible, setIsH1Visible] = useState(true);

  const observeH1 = useCallback(() => {
    // 查找编辑器容器内的第一个 H1
    const editorContainer = document.querySelector('.editor-container');
    if (!editorContainer) return null;

    const h1Element = editorContainer.querySelector('h1');
    if (!h1Element) {
      // 没有 H1，默认显示顶栏标题
      setIsH1Visible(false);
      return null;
    }

    // 使用 IntersectionObserver 监听 H1 可见性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // 当 H1 的任何部分可见时，隐藏顶栏标题
          setIsH1Visible(entry.isIntersecting);
        });
      },
      {
        // 相对于编辑器容器
        root: editorContainer,
        // 当 H1 完全离开视口时触发
        threshold: 0,
        // 提前一点触发，让过渡更平滑
        rootMargin: '0px 0px 0px 0px',
      }
    );

    observer.observe(h1Element);
    return observer;
  }, []);

  useEffect(() => {
    if (!editorKey) {
      setIsH1Visible(true);
      return;
    }

    // 等待 DOM 更新后再观察
    const timeoutId = setTimeout(() => {
      const observer = observeH1();

      // 清理函数
      return () => {
        observer?.disconnect();
      };
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [editorKey, observeH1]);

  // 当文档切换时重置状态
  useEffect(() => {
    setIsH1Visible(true);
  }, [editorKey]);

  return { isH1Visible };
}
