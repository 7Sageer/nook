import { useState, useEffect, useCallback } from 'react';
import { DocumentMeta } from '../types/document';
import {
  GetDocumentList,
  CreateDocument,
  DeleteDocument,
  RenameDocument,
  SetActiveDocument,
  LoadDocumentContent,
  SaveDocumentContent,
} from '../../wailsjs/go/main/App';

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    const index = await GetDocumentList();
    setDocuments(index.documents || []);
    setActiveId(index.activeId || null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // 增量更新：创建文档
  const createDoc = useCallback(async (title: string = '无标题') => {
    const doc = await CreateDocument(title);
    setDocuments(prev => [doc, ...prev]);
    setActiveId(doc.id);
    return doc;
  }, []);

  // 增量更新：删除文档
  const deleteDoc = useCallback(async (id: string) => {
    await DeleteDocument(id);
    setDocuments(prev => {
      const remaining = prev.filter(d => d.id !== id);
      // 如果删除的是当前活动文档，切换到第一个
      if (activeId === id && remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else if (remaining.length === 0) {
        setActiveId(null);
      }
      return remaining;
    });
  }, [activeId]);

  // 增量更新：重命名文档
  const renameDoc = useCallback(async (id: string, newTitle: string) => {
    await RenameDocument(id, newTitle);
    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d)
    );
  }, []);

  const switchDoc = useCallback(async (id: string) => {
    await SetActiveDocument(id);
    setActiveId(id);
  }, []);

  const loadContent = useCallback(async (id: string) => {
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

  const saveContent = useCallback(async (id: string, content: any) => {
    await SaveDocumentContent(id, JSON.stringify(content));
  }, []);

  return {
    documents,
    activeId,
    isLoading,
    createDoc,
    deleteDoc,
    renameDoc,
    switchDoc,
    loadContent,
    saveContent,
    refresh: loadDocuments,
  };
}
