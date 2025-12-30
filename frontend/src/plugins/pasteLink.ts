/**
 * Paste Link Utilities
 * 
 * Provides URL validation and type definitions for the paste link menu feature.
 * The actual paste handling is done via DOM event listeners in Editor.tsx.
 */

// URL 正则表达式
const URL_REGEX = /^https?:\/\/[^\s]+$/i;

export interface PasteLinkState {
  url: string;
  position: { x: number; y: number };
  cursorPos: number;
}

/**
 * 检测字符串是否是有效的 URL
 */
export function isValidUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!URL_REGEX.test(trimmed)) {
    return false;
  }
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}
