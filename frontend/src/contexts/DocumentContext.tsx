/**
 * DocumentContext - Refactored to use Zustand store
 * 
 * This context now acts as a thin wrapper around the Zustand store,
 * providing backward compatibility with existing components.
 */

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { Block } from '@blocknote/core';
import { DocumentMeta } from '../types/document';
import { getStrings } from '../constants/strings';
import { useSettings } from './SettingsContext';
import {
  useAppStore,
  useDocuments,
  useActiveId,
  useIsLoading,
} from '../store/store';

interface DocumentContextType {
  // Document state
  documents: DocumentMeta[];
  activeId: string | null;
  isLoading: boolean;

  // Document operations
  createDoc: (title?: string, pinnedTagName?: string) => Promise<DocumentMeta>;
  deleteDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, title: string) => Promise<void>;
  switchDoc: (id: string) => Promise<void>;
  reorderDocuments: (ids: string[]) => Promise<void>;

  // Document tag operations
  addTag: (docId: string, tag: string) => Promise<void>;
  removeTag: (docId: string, tag: string) => Promise<void>;

  // Content operations
  loadContent: (id: string) => Promise<Block[] | undefined>;
  saveContent: (id: string, content: Block[]) => Promise<void>;

  // Refresh
  refreshDocuments: () => Promise<void>;

  // Internal methods (for backward compatibility)
  updateTagInDocuments: (oldName: string, newName: string) => void;
  removeTagFromAllDocs: (tagName: string) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { language } = useSettings();
  const STRINGS = getStrings(language);

  // Get state from Zustand store
  const documents = useDocuments();
  const activeId = useActiveId();
  const isLoading = useIsLoading();

  // Get actions from store
  const store = useAppStore;

  // Initialize on mount
  useEffect(() => {
    store.getState().initDocuments();
  }, []);

  // Create wrapper functions that use default title
  const createDoc = async (title?: string, pinnedTagName?: string) => {
    return store.getState().createDoc(title || STRINGS.DEFAULTS.UNTITLED, pinnedTagName);
  };

  const value: DocumentContextType = {
    // State
    documents,
    activeId,
    isLoading,

    // Document operations
    createDoc,
    deleteDoc: store.getState().deleteDoc,
    renameDoc: store.getState().renameDoc,
    switchDoc: store.getState().switchDoc,
    reorderDocuments: store.getState().reorderDocuments,

    // Tag operations (mapped to store's combined actions)
    addTag: store.getState().addTagToDoc,
    removeTag: store.getState().removeTagFromDoc,

    // Content operations
    loadContent: store.getState().loadContent,
    saveContent: store.getState().saveContent,

    // Refresh
    refreshDocuments: store.getState().refreshDocuments,

    // Internal methods - now no-ops since store handles everything
    updateTagInDocuments: () => { },
    removeTagFromAllDocs: () => { },
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
