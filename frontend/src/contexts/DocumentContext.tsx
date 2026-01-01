import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { DocumentMeta, TagInfo } from '../types/document';
import { Block } from '@blocknote/core';
import { getStrings } from '../constants/strings';
import { useSettings } from './SettingsContext';
import {
  GetDocumentList,
  CreateDocument,
  DeleteDocument,
  RenameDocument,
  SetActiveDocument,
  LoadDocumentContent,
  SaveDocumentContent,
  ReorderDocuments,
  AddDocumentTag,
  RemoveDocumentTag,
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
} from '../../wailsjs/go/main/App';

interface DocumentContextType {
  // 文档状态
  documents: DocumentMeta[];
  activeId: string | null;
  isLoading: boolean;

  // 标签状态
  allTags: TagInfo[];
  pinnedTags: TagInfo[];
  selectedTag: string | null;
  tagColors: Record<string, string>;

  // 文档操作
  createDoc: (title?: string, pinnedTagName?: string) => Promise<DocumentMeta>;
  deleteDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, title: string) => Promise<void>;
  switchDoc: (id: string) => Promise<void>;
  reorderDocuments: (ids: string[]) => Promise<void>;

  // 固定标签操作
  pinTag: (name: string) => Promise<void>;
  unpinTag: (name: string) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  togglePinnedTagCollapsed: (name: string) => Promise<void>;
  reorderPinnedTags: (names: string[]) => Promise<void>;

  // 标签操作
  addTag: (docId: string, tag: string) => Promise<void>;
  removeTag: (docId: string, tag: string) => Promise<void>;
  setSelectedTag: (tag: string | null) => void;
  setTagColor: (tagName: string, color: string) => Promise<void>;
  refreshTags: () => Promise<void>;

  // 内容操作
  loadContent: (id: string) => Promise<Block[] | undefined>;
  saveContent: (id: string, content: Block[]) => Promise<void>;

  // 刷新操作
  refreshDocuments: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  const STRINGS = getStrings(language);

  // 文档状态
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 标签状态
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [pinnedTags, setPinnedTags] = useState<TagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  const pinnedTagsRef = useRef<TagInfo[]>([]);
  useEffect(() => {
    pinnedTagsRef.current = pinnedTags;
  }, [pinnedTags]);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const [index, tags, pinned, colors] = await Promise.all([
          GetDocumentList(),
          GetAllTags(),
          GetPinnedTags(),
          GetTagColors(),
        ]);
        setDocuments(index.documents || []);
        setActiveId(index.activeId || null);
        setAllTags(tags || []);
        setPinnedTags(pinned || []);
        setTagColors(colors || {});
      } catch (e) {
        console.error('初始化加载失败:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 刷新文档列表和固定标签
  const refreshDocuments = useCallback(async (): Promise<void> => {
    try {
      const [index, pinned] = await Promise.all([
        GetDocumentList(),
        GetPinnedTags(),
      ]);
      setDocuments(index.documents || []);
      setActiveId(prev => {
        const exists = (index.documents || []).some(d => d.id === prev);
        return exists ? prev : (index.activeId || null);
      });
      setPinnedTags(pinned || []);
    } catch (e) {
      console.error('刷新文档列表失败:', e);
    }
  }, []);

  // ========== 文档操作 ==========

  const createDoc = useCallback(async (title: string = STRINGS.DEFAULTS.UNTITLED, pinnedTagName?: string): Promise<DocumentMeta> => {
    const doc = await CreateDocument(title);
    // 如果指定了固定标签，添加该标签
    if (pinnedTagName) {
      await AddDocumentTag(doc.id, pinnedTagName);
      doc.tags = [pinnedTagName];
    }
    setDocuments(prev => [doc, ...prev]);
    setActiveId(doc.id);
    return doc;
  }, [STRINGS.DEFAULTS.UNTITLED]);

  const deleteDoc = useCallback(async (id: string): Promise<void> => {
    await DeleteDocument(id);
    setDocuments(prev => {
      const remaining = prev.filter(d => d.id !== id);
      setActiveId(currentActiveId => {
        if (currentActiveId === id) {
          return remaining.length > 0 ? remaining[0].id : null;
        }
        return currentActiveId;
      });
      return remaining;
    });
  }, []);

  const renameDoc = useCallback(async (id: string, newTitle: string): Promise<void> => {
    await RenameDocument(id, newTitle);
    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d)
    );
  }, []);

  const switchDoc = useCallback(async (id: string): Promise<void> => {
    await SetActiveDocument(id);
    setActiveId(id);
  }, []);

  const reorderDocuments = useCallback(async (ids: string[]): Promise<void> => {
    await ReorderDocuments(ids);
    setDocuments(prev => {
      const orderMap = new Map(ids.map((id, index) => [id, index]));
      return [...prev].map(d => ({
        ...d,
        order: orderMap.get(d.id) ?? d.order,
      })).sort((a, b) => a.order - b.order);
    });
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
    // 从文档中移除该标签
    setDocuments(prev =>
      prev.map(d => ({
        ...d,
        tags: (d.tags || []).filter(t => t !== name),
      }))
    );
    // 同时更新 allTags
    setAllTags(prev => prev.filter(t => t.name !== name));
  }, []);

  const renameTagFn = useCallback(async (oldName: string, newName: string): Promise<void> => {
    await RenameTag(oldName, newName);
    // 增量更新固定标签
    setPinnedTags(prev =>
      prev.map(t => t.name === oldName ? { ...t, name: newName } : t)
    );
    // 更新文档中的标签
    setDocuments(prev =>
      prev.map(d => ({
        ...d,
        tags: (d.tags || []).map(t => t === oldName ? newName : t),
      }))
    );
    // 更新 allTags
    setAllTags(prev =>
      prev.map(t => t.name === oldName ? { ...t, name: newName } : t)
    );
  }, []);

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

  const addTag = useCallback(async (docId: string, tag: string): Promise<void> => {
    await AddDocumentTag(docId, tag);
    setDocuments(prev =>
      prev.map(d => d.id === docId
        ? { ...d, tags: [...(d.tags || []), tag], updatedAt: Date.now() }
        : d
      )
    );
    setAllTags(prev => {
      const existingTag = prev.find(t => t.name === tag);
      if (existingTag) {
        return prev.map(t => t.name === tag ? { ...t, count: t.count + 1 } : t);
      } else {
        return [...prev, { name: tag, count: 1 }];
      }
    });
  }, []);

  const removeTag = useCallback(async (docId: string, tag: string): Promise<void> => {
    await RemoveDocumentTag(docId, tag);
    setDocuments(prev =>
      prev.map(d => d.id === docId
        ? { ...d, tags: (d.tags || []).filter(t => t !== tag), updatedAt: Date.now() }
        : d
      )
    );
    // 更新 allTags
    setAllTags(prev => {
      const existingTag = prev.find(t => t.name === tag);
      // 不要移除 isPinned 的标签，即使 count 为 0
      if (existingTag?.isPinned) {
        return prev.map(t => t.name === tag ? { ...t, count: Math.max(0, t.count - 1) } : t);
      }
      if (existingTag && existingTag.count > 1) {
        return prev.map(t => t.name === tag ? { ...t, count: t.count - 1 } : t);
      } else {
        return prev.filter(t => t.name !== tag);
      }
    });
  }, []);

  // ========== 内容操作 ==========

  const loadContent = useCallback(async (id: string): Promise<Block[] | undefined> => {
    const content = await LoadDocumentContent(id);
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, []);

  const saveContent = useCallback(async (id: string, content: Block[]): Promise<void> => {
    await SaveDocumentContent(id, JSON.stringify(content));
  }, []);

  // 将 setTagColor 和 refreshTags 提取为 useCallback，以便 useMemo 正确追踪依赖
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

  // 使用 useMemo 缓存 context value，避免不必要的重新渲染
  const value = useMemo<DocumentContextType>(() => ({
    // 状态
    documents,
    activeId,
    isLoading,
    allTags,
    pinnedTags,
    selectedTag,
    tagColors,

    // 文档操作
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    reorderDocuments,

    // 固定标签操作
    pinTag: pinTagFn,
    unpinTag: unpinTagFn,
    renameTag: renameTagFn,
    deleteTag: deleteTagFn,
    togglePinnedTagCollapsed,
    reorderPinnedTags: reorderPinnedTagsFn,

    // 标签操作
    addTag,
    removeTag,
    setSelectedTag,
    setTagColor: setTagColorFn,
    refreshTags,

    // 内容操作
    loadContent,
    saveContent,

    // 刷新操作
    refreshDocuments,
  }), [
    // 状态依赖
    documents, activeId, isLoading, allTags, pinnedTags, selectedTag, tagColors,
    // 操作依赖
    createDoc, deleteDoc, renameDoc, switchDoc, reorderDocuments,
    pinTagFn, unpinTagFn, renameTagFn, deleteTagFn, togglePinnedTagCollapsed, reorderPinnedTagsFn,
    addTag, removeTag, setTagColorFn, refreshTags,
    loadContent, saveContent, refreshDocuments,
  ]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentContext() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentProvider');
  }
  return context;
}
