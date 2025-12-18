import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DocumentMeta, Folder } from '../types/document';
import { Block } from '@blocknote/core';
import {
  GetDocumentList,
  CreateDocument,
  DeleteDocument,
  RenameDocument,
  SetActiveDocument,
  LoadDocumentContent,
  SaveDocumentContent,
  ReorderDocuments,
  GetFolders,
  CreateFolder,
  DeleteFolder,
  RenameFolder,
  SetFolderCollapsed,
  MoveDocumentToFolder,
  ReorderFolders,
} from '../../wailsjs/go/main/App';

interface DocumentContextType {
  // 文档状态
  documents: DocumentMeta[];
  activeId: string | null;
  isLoading: boolean;

  // 文件夹状态
  folders: Folder[];

  // 文档操作
  createDoc: (title?: string, folderId?: string) => Promise<DocumentMeta>;
  deleteDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, title: string) => Promise<void>;
  switchDoc: (id: string) => Promise<void>;
  reorderDocuments: (ids: string[]) => Promise<void>;

  // 文件夹操作
  createFolder: (name?: string) => Promise<Folder | null>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  toggleFolderCollapsed: (id: string) => Promise<void>;
  moveDocumentToFolder: (docId: string, folderId: string) => Promise<void>;
  reorderFolders: (ids: string[]) => Promise<void>;

  // 内容操作
  loadContent: (id: string) => Promise<Block[] | undefined>;
  saveContent: (id: string, content: Block[]) => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  // 文档状态
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 文件夹状态
  const [folders, setFolders] = useState<Folder[]>([]);

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const [index, folderList] = await Promise.all([
          GetDocumentList(),
          GetFolders(),
        ]);
        setDocuments(index.documents || []);
        setActiveId(index.activeId || null);
        setFolders(folderList || []);
      } catch (e) {
        console.error('初始化加载失败:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // ========== 文档操作 ==========

  const createDoc = useCallback(async (title: string = '无标题', folderId?: string): Promise<DocumentMeta> => {
    const doc = await CreateDocument(title);
    // 如果指定了文件夹，移动到该文件夹
    if (folderId) {
      await MoveDocumentToFolder(doc.id, folderId);
      doc.folderId = folderId;
    }
    // 增量更新
    setDocuments(prev => [doc, ...prev]);
    setActiveId(doc.id);
    return doc;
  }, []);

  const deleteDoc = useCallback(async (id: string): Promise<void> => {
    await DeleteDocument(id);
    // 增量更新
    setDocuments(prev => prev.filter(d => d.id !== id));
    // 如果删除的是当前活动文档，切换到第一个
    setActiveId(prev => {
      if (prev === id) {
        const remaining = documents.filter(d => d.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }, [documents]);

  const renameDoc = useCallback(async (id: string, newTitle: string): Promise<void> => {
    await RenameDocument(id, newTitle);
    // 增量更新
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
    // 更新本地状态的顺序
    setDocuments(prev => {
      const orderMap = new Map(ids.map((id, index) => [id, index]));
      return [...prev].map(d => ({
        ...d,
        order: orderMap.get(d.id) ?? d.order,
      })).sort((a, b) => a.order - b.order);
    });
  }, []);

  // ========== 文件夹操作 ==========

  const createFolderFn = useCallback(async (name?: string): Promise<Folder | null> => {
    try {
      const folder = await CreateFolder(name || '');
      // 增量更新
      setFolders(prev => [folder, ...prev]);
      return folder;
    } catch (e) {
      console.error('创建文件夹失败:', e);
      return null;
    }
  }, []);

  const deleteFolderFn = useCallback(async (id: string): Promise<void> => {
    await DeleteFolder(id);
    // 增量更新：删除文件夹
    setFolders(prev => prev.filter(f => f.id !== id));
    // 将该文件夹内的文档移到未分类
    setDocuments(prev =>
      prev.map(d => d.folderId === id ? { ...d, folderId: undefined } : d)
    );
  }, []);

  const renameFolderFn = useCallback(async (id: string, newName: string): Promise<void> => {
    await RenameFolder(id, newName);
    // 增量更新
    setFolders(prev =>
      prev.map(f => f.id === id ? { ...f, name: newName } : f)
    );
  }, []);

  const toggleFolderCollapsed = useCallback(async (id: string): Promise<void> => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    const newCollapsed = !folder.collapsed;
    await SetFolderCollapsed(id, newCollapsed);
    // 增量更新
    setFolders(prev =>
      prev.map(f => f.id === id ? { ...f, collapsed: newCollapsed } : f)
    );
  }, [folders]);

  const moveDocumentToFolderFn = useCallback(async (docId: string, folderId: string): Promise<void> => {
    await MoveDocumentToFolder(docId, folderId);
    // 增量更新
    setDocuments(prev =>
      prev.map(d => d.id === docId ? { ...d, folderId: folderId || undefined } : d)
    );
  }, []);

  const reorderFoldersFn = useCallback(async (ids: string[]): Promise<void> => {
    await ReorderFolders(ids);
    // 更新本地状态的顺序
    setFolders(prev => {
      const orderMap = new Map(ids.map((id, index) => [id, index]));
      return [...prev].map(f => ({
        ...f,
        order: orderMap.get(f.id) ?? f.order,
      })).sort((a, b) => a.order - b.order);
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

  const value: DocumentContextType = {
    // 状态
    documents,
    activeId,
    isLoading,
    folders,

    // 文档操作
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    reorderDocuments,

    // 文件夹操作
    createFolder: createFolderFn,
    deleteFolder: deleteFolderFn,
    renameFolder: renameFolderFn,
    toggleFolderCollapsed,
    moveDocumentToFolder: moveDocumentToFolderFn,
    reorderFolders: reorderFoldersFn,

    // 内容操作
    loadContent,
    saveContent,
  };

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
