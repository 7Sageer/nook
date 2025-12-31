import { useEffect, useRef, useCallback, useState } from "react";
import { getStrings } from "../constants/strings";
import "../styles/PasteLinkMenu.css";

interface PasteLinkMenuProps {
  url: string;
  position: { x: number; y: number };
  onPasteAsText: () => void;
  onCreateBookmark: () => void;
  onDismiss: () => void;
  language?: string;
}

/**
 * 粘贴链接时显示的浮动菜单
 * 让用户选择直接粘贴文本还是创建书签
 */
export function PasteLinkMenu({
  url,
  position,
  onPasteAsText,
  onCreateBookmark,
  onDismiss,
  language = "en",
}: PasteLinkMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const pasteButtonRef = useRef<HTMLButtonElement>(null);
  const bookmarkButtonRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const STRINGS = getStrings(language);

  // 菜单打开时自动聚焦第一个选项
  useEffect(() => {
    pasteButtonRef.current?.focus();
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }

      // 键盘导航：ArrowDown/ArrowUp 在选项间移动
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(1);
        bookmarkButtonRef.current?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(0);
        pasteButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  // 调整菜单位置，确保不超出视口
  const adjustedPosition = useCallback(() => {
    const menuWidth = 220;
    const menuHeight = 100;
    const padding = 8;

    let x = position.x;
    let y = position.y;

    // 检查右边界
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    // 检查下边界
    if (y + menuHeight > window.innerHeight - padding) {
      y = position.y - menuHeight - 8;
    }

    return { x, y };
  }, [position]);

  const pos = adjustedPosition();

  // 截断过长的 URL 显示
  const displayUrl = url.length > 40 ? url.slice(0, 37) + "..." : url;

  return (
    <div
      ref={menuRef}
      className="paste-link-menu"
      role="menu"
      aria-label="Paste link options"
      style={{
        left: pos.x,
        top: pos.y,
      }}
    >
      <div className="paste-link-menu-header">
        <span className="paste-link-menu-url" title={url}>
          {displayUrl}
        </span>
      </div>
      <div className="paste-link-menu-options">
        <button
          ref={pasteButtonRef}
          className="paste-link-menu-option"
          role="menuitem"
          onClick={onPasteAsText}
          aria-label={STRINGS.PASTE_LINK?.AS_LINK || "Paste as link"}
        >
          <LinkIcon aria-hidden="true" />
          <span>{STRINGS.PASTE_LINK?.AS_LINK || "Paste as link"}</span>
        </button>
        <button
          ref={bookmarkButtonRef}
          className="paste-link-menu-option"
          role="menuitem"
          onClick={onCreateBookmark}
          aria-label={STRINGS.PASTE_LINK?.AS_BOOKMARK || "Create bookmark"}
        >
          <BookmarkIcon aria-hidden="true" />
          <span>{STRINGS.PASTE_LINK?.AS_BOOKMARK || "Create bookmark"}</span>
        </button>
      </div>
    </div>
  );
}

// 链接图标
function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// 书签图标
function BookmarkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default PasteLinkMenu;
