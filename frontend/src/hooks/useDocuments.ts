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

  const createDoc = async (title: string = '无标题') => {
    const doc = await CreateDocument(title);
    await loadDocuments();
    return doc;
  };

  const deleteDoc = async (id: string) => {
    await DeleteDocument(id);
    await loadDocuments();
  };

  const renameDoc = async (id: string, newTitle: string) => {
    await RenameDocument(id, newTitle);
    await loadDocuments();
  };

  const switchDoc = async (id: string) => {
    await SetActiveDocument(id);
    setActiveId(id);
  };

  const loadContent = async (id: string) => {
    const content = await LoadDocumentContent(id);
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const saveContent = async (id: string, content: any) => {
    await SaveDocumentContent(id, JSON.stringify(content));
  };

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
