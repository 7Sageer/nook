import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { DocumentMeta } from '../types/document';
import { Block } from '@blocknote/core';
import { getStrings } from '../constants/strings';
import { useSettings } from './SettingsContext';
import { useTagContext } from './TagContext';
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
} from '../../wailsjs/go/main/App';

interface DocumentContextType {
  // 文档状态
  documents: DocumentMeta[];
  activeId: string | null;
  isLoading: boolean;

  // 文档操作
  createDoc: (title?: string, pinnedTagName?: string) => Promise<DocumentMeta>;
  deleteDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, title: string) => Promise<void>;
  switchDoc: (id: string) => Promise<void>;
  reorderDocuments: (ids: string[]) => Promise<void>;

  // 文档标签操作（更新文档的 tags 字段）
  addTag: (docId: string, tag: string) => Promise<void>;
  removeTag: (docId: string, tag: string) => Promise<void>;

  // 内容操作
  loadContent: (id: string) => Promise<Block[] | undefined>;
  saveContent: (id: string, content: Block[]) => Promise<void>;

  // 刷新操作
  refreshDocuments: () => Promise<void>;

  // 内部方法（供 TagContext 回调使用）
  updateTagInDocuments: (oldName: string, newName: string) => void;
  removeTagFromAllDocs: (tagName: string) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  const STRINGS = getStrings(language);
  const { incrementTagCount, decrementTagCount } = useTagContext();

  // 文档状态
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const index = await GetDocumentList();
        setDocuments(index.documents || []);
        setActiveId(index.activeId || null);
      } catch (e) {
        console.error('初始化加载失败:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 刷新文档列表
  const refreshDocuments = useCallback(async (): Promise<void> => {
    try {
      const index = await GetDocumentList();
      setDocuments(index.documents || []);
      setActiveId(prev => {
        const exists = (index.documents || []).some(d => d.id === prev);
        return exists ? prev : (index.activeId || null);
      });
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

  // ========== 文档标签操作 ==========

  const addTag = useCallback(async (docId: string, tag: string): Promise<void> => {
    await AddDocumentTag(docId, tag);
    setDocuments(prev =>
      prev.map(d => d.id === docId
        ? { ...d, tags: [...(d.tags || []), tag], updatedAt: Date.now() }
        : d
      )
    );
    // 通知 TagContext 更新标签计数
    incrementTagCount(tag);
  }, [incrementTagCount]);

  const removeTag = useCallback(async (docId: string, tag: string): Promise<void> => {
    await RemoveDocumentTag(docId, tag);
    setDocuments(prev =>
      prev.map(d => d.id === docId
        ? { ...d, tags: (d.tags || []).filter(t => t !== tag), updatedAt: Date.now() }
        : d
      )
    );
    // 通知 TagContext 更新标签计数
    decrementTagCount(tag);
  }, [decrementTagCount]);

  // 内部方法：供 TagContext 回调使用
  const updateTagInDocuments = useCallback((oldName: string, newName: string) => {
    setDocuments(prev =>
      prev.map(d => ({
        ...d,
        tags: (d.tags || []).map(t => t === oldName ? newName : t),
      }))
    );
  }, []);

  const removeTagFromAllDocs = useCallback((tagName: string) => {
    setDocuments(prev =>
      prev.map(d => ({
        ...d,
        tags: (d.tags || []).filter(t => t !== tagName),
      }))
    );
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

  // 使用 useMemo 缓存 context value，避免不必要的重新渲染
  const value = useMemo<DocumentContextType>(() => ({
    // 状态
    documents,
    activeId,
    isLoading,

    // 文档操作
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    reorderDocuments,

    // 文档标签操作
    addTag,
    removeTag,

    // 内容操作
    loadContent,
    saveContent,

    // 刷新操作
    refreshDocuments,

    // 内部方法
    updateTagInDocuments,
    removeTagFromAllDocs,
  }), [
    documents, activeId, isLoading,
    createDoc, deleteDoc, renameDoc, switchDoc, reorderDocuments,
    addTag, removeTag,
    loadContent, saveContent, refreshDocuments,
    updateTagInDocuments, removeTagFromAllDocs,
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
