import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { TagInfo, TagSuggestion } from '../types/document';
import {
  GetAllTags,
  GetTagColors,
  SetTagColor,
  PinTag,
  UnpinTag,
  SetPinnedTagCollapsed,
  GetPinnedTags,
  ReorderPinnedTags,
  RenameTag,
  DeleteTag,
  SuggestTags,
} from '../../wailsjs/go/main/App';

interface TagContextType {
  // 标签状态
  allTags: TagInfo[];
  pinnedTags: TagInfo[];
  selectedTag: string | null;
  tagColors: Record<string, string>;
  suggestedTags: TagSuggestion[];
  isLoadingSuggestions: boolean;

  // 固定标签操作
  pinTag: (name: string) => Promise<void>;
  unpinTag: (name: string) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  togglePinnedTagCollapsed: (name: string) => Promise<void>;
  reorderPinnedTags: (names: string[]) => Promise<void>;

  // 标签操作
  setSelectedTag: (tag: string | null) => void;
  setTagColor: (tagName: string, color: string) => Promise<void>;
  refreshTags: () => Promise<void>;
  fetchSuggestedTags: (docId: string) => Promise<void>;
  clearSuggestedTags: () => void;

  // 内部方法（供 DocumentContext 调用）
  incrementTagCount: (tagName: string) => void;
  decrementTagCount: (tagName: string) => void;
  updateTagInDocuments: (oldName: string, newName: string) => void;
  removeTagFromAllDocs: (tagName: string) => void;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

interface TagProviderProps {
  children: ReactNode;
  // 回调函数，用于通知 DocumentContext 更新文档中的标签
  onTagRenamed?: (oldName: string, newName: string) => void;
  onTagDeleted?: (tagName: string) => void;
}

export function TagProvider({ children, onTagRenamed, onTagDeleted }: TagProviderProps) {
  // 标签状态
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [pinnedTags, setPinnedTags] = useState<TagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [suggestedTags, setSuggestedTags] = useState<TagSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const pinnedTagsRef = useRef<TagInfo[]>([]);
  useEffect(() => {
    pinnedTagsRef.current = pinnedTags;
  }, [pinnedTags]);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const [tags, pinned, colors] = await Promise.all([
          GetAllTags(),
          GetPinnedTags(),
          GetTagColors(),
        ]);
        setAllTags(tags || []);
        setPinnedTags(pinned || []);
        setTagColors(colors || {});
      } catch (e) {
        console.error('标签初始化加载失败:', e);
      }
    };
    init();
  }, []);

  // ========== 固定标签操作 ==========

  const pinTagFn = useCallback(async (name: string): Promise<void> => {
    await PinTag(name);
    // 增量更新 pinnedTags
    setPinnedTags(prev => [...prev, {
      name: name,
      count: 0,
      isPinned: true,
      collapsed: false,
      order: prev.length,
    }]);
    // 同时更新 allTags 中的 isPinned 状态
    setAllTags(prev => prev.map(t => t.name === name ? { ...t, isPinned: true } : t));
  }, []);

  const unpinTagFn = useCallback(async (name: string): Promise<void> => {
    await UnpinTag(name);
    setPinnedTags(prev => prev.filter(t => t.name !== name));
    // 同时更新 allTags 中的 isPinned 状态
    setAllTags(prev => prev.map(t => t.name === name ? { ...t, isPinned: false } : t));
  }, []);

  const deleteTagFn = useCallback(async (name: string): Promise<void> => {
    await DeleteTag(name);
    // 从固定标签中移除
    setPinnedTags(prev => prev.filter(t => t.name !== name));
    // 同时更新 allTags
    setAllTags(prev => prev.filter(t => t.name !== name));
    // 通知 DocumentContext 更新文档
    onTagDeleted?.(name);
  }, [onTagDeleted]);

  const renameTagFn = useCallback(async (oldName: string, newName: string): Promise<void> => {
    await RenameTag(oldName, newName);
    // 增量更新固定标签
    setPinnedTags(prev =>
      prev.map(t => t.name === oldName ? { ...t, name: newName } : t)
    );
    // 更新 allTags
    setAllTags(prev =>
      prev.map(t => t.name === oldName ? { ...t, name: newName } : t)
    );
    // 通知 DocumentContext 更新文档
    onTagRenamed?.(oldName, newName);
  }, [onTagRenamed]);

  const togglePinnedTagCollapsed = useCallback(async (name: string): Promise<void> => {
    const currentTag = pinnedTagsRef.current.find(t => t.name === name);
    if (!currentTag) return;

    const previousCollapsed = currentTag.collapsed ?? false;
    const nextCollapsed = !previousCollapsed;

    setPinnedTags(prev => prev.map(t => t.name === name ? { ...t, collapsed: nextCollapsed } : t));
    try {
      await SetPinnedTagCollapsed(name, nextCollapsed);
    } catch (e) {
      console.error('设置固定标签折叠状态失败:', e);
      setPinnedTags(prev => prev.map(t => t.name === name ? { ...t, collapsed: previousCollapsed } : t));
    }
  }, []);

  const reorderPinnedTagsFn = useCallback(async (names: string[]): Promise<void> => {
    await ReorderPinnedTags(names);
    setPinnedTags(prev => {
      const orderMap = new Map(names.map((name, index) => [name, index]));
      return [...prev].map(t => ({
        ...t,
        order: orderMap.get(t.name) ?? t.order,
      })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
  }, []);

  // ========== 标签操作 ==========

  const setTagColorFn = useCallback(async (tagName: string, color: string) => {
    await SetTagColor(tagName, color);
    setTagColors(prev => ({ ...prev, [tagName]: color }));
    setAllTags(prev => prev.map(t => t.name === tagName ? { ...t, color } : t));
  }, []);

  const refreshTags = useCallback(async () => {
    const [tags, pinned, colors] = await Promise.all([GetAllTags(), GetPinnedTags(), GetTagColors()]);
    setAllTags(tags || []);
    setPinnedTags(pinned || []);
    setTagColors(colors || {});
  }, []);

  const fetchSuggestedTags = useCallback(async (docId: string) => {
    setIsLoadingSuggestions(true);
    try {
      const suggestions = await SuggestTags(docId);
      setSuggestedTags(suggestions || []);
    } catch (e) {
      console.error('获取推荐标签失败:', e);
      setSuggestedTags([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  const clearSuggestedTags = useCallback(() => {
    setSuggestedTags([]);
  }, []);

  // ========== 内部方法（供 DocumentContext 调用） ==========

  const incrementTagCount = useCallback((tagName: string) => {
    setAllTags(prev => {
      const existingTag = prev.find(t => t.name === tagName);
      if (existingTag) {
        return prev.map(t => t.name === tagName ? { ...t, count: t.count + 1 } : t);
      } else {
        return [...prev, { name: tagName, count: 1 }];
      }
    });
  }, []);

  const decrementTagCount = useCallback((tagName: string) => {
    setAllTags(prev => {
      const existingTag = prev.find(t => t.name === tagName);
      // 不要移除 isPinned 的标签，即使 count 为 0
      if (existingTag?.isPinned) {
        return prev.map(t => t.name === tagName ? { ...t, count: Math.max(0, t.count - 1) } : t);
      }
      if (existingTag && existingTag.count > 1) {
        return prev.map(t => t.name === tagName ? { ...t, count: t.count - 1 } : t);
      } else {
        return prev.filter(t => t.name !== tagName);
      }
    });
  }, []);

  // 这些方法用于同步更新（当 DocumentContext 需要更新时调用）
  const updateTagInDocuments = useCallback((_oldName: string, _newName: string) => {
    // 这个方法由 DocumentContext 实现，这里只是占位
  }, []);

  const removeTagFromAllDocs = useCallback((_tagName: string) => {
    // 这个方法由 DocumentContext 实现，这里只是占位
  }, []);

  // 使用 useMemo 缓存 context value
  const value = useMemo<TagContextType>(() => ({
    // 状态
    allTags,
    pinnedTags,
    selectedTag,
    tagColors,
    suggestedTags,
    isLoadingSuggestions,

    // 固定标签操作
    pinTag: pinTagFn,
    unpinTag: unpinTagFn,
    renameTag: renameTagFn,
    deleteTag: deleteTagFn,
    togglePinnedTagCollapsed,
    reorderPinnedTags: reorderPinnedTagsFn,

    // 标签操作
    setSelectedTag,
    setTagColor: setTagColorFn,
    refreshTags,
    fetchSuggestedTags,
    clearSuggestedTags,

    // 内部方法
    incrementTagCount,
    decrementTagCount,
    updateTagInDocuments,
    removeTagFromAllDocs,
  }), [
    allTags, pinnedTags, selectedTag, tagColors, suggestedTags, isLoadingSuggestions,
    pinTagFn, unpinTagFn, renameTagFn, deleteTagFn, togglePinnedTagCollapsed, reorderPinnedTagsFn,
    setTagColorFn, refreshTags, fetchSuggestedTags, clearSuggestedTags,
    incrementTagCount, decrementTagCount, updateTagInDocuments, removeTagFromAllDocs,
  ]);

  return (
    <TagContext.Provider value={value}>
      {children}
    </TagContext.Provider>
  );
}

export function useTagContext() {
  const context = useContext(TagContext);
  if (!context) {
    throw new Error('useTagContext must be used within TagProvider');
  }
  return context;
}
