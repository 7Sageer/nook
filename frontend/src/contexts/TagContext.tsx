/**
 * TagContext - Refactored to use Zustand store
 * 
 * This context now acts as a thin wrapper around the Zustand store,
 * providing backward compatibility with existing components.
 */

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { TagInfo, TagSuggestion } from '../types/document';
import {
  useAppStore,
  useAllTags,
  usePinnedTags,
  useSelectedTag,
  useTagColors,
  useSuggestedTags,
  useIsLoadingSuggestions,
} from '../store/store';

interface TagContextType {
  // Tag state
  allTags: TagInfo[];
  pinnedTags: TagInfo[];
  selectedTag: string | null;
  tagColors: Record<string, string>;
  suggestedTags: TagSuggestion[];
  isLoadingSuggestions: boolean;

  // Pinned tag operations
  pinTag: (name: string) => Promise<void>;
  unpinTag: (name: string) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  togglePinnedTagCollapsed: (name: string) => Promise<void>;
  reorderPinnedTags: (names: string[]) => Promise<void>;

  // Tag operations
  setSelectedTag: (tag: string | null) => void;
  setTagColor: (tagName: string, color: string) => Promise<void>;
  refreshTags: () => Promise<void>;
  fetchSuggestedTags: (docId: string) => Promise<void>;
  clearSuggestedTags: () => void;

  // Internal methods (for backward compatibility - now no-ops)
  incrementTagCount: (tagName: string) => void;
  decrementTagCount: (tagName: string) => void;
  updateTagInDocuments: (oldName: string, newName: string) => void;
  removeTagFromAllDocs: (tagName: string) => void;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

interface TagProviderProps {
  children: ReactNode;
  // Legacy props - no longer needed but kept for backward compatibility
  onTagRenamed?: (oldName: string, newName: string) => void;
  onTagDeleted?: (tagName: string) => void;
}

export function TagProvider({ children }: TagProviderProps) {
  // Get state from Zustand store
  const allTags = useAllTags();
  const pinnedTags = usePinnedTags();
  const selectedTag = useSelectedTag();
  const tagColors = useTagColors();
  const suggestedTags = useSuggestedTags();
  const isLoadingSuggestions = useIsLoadingSuggestions();

  // Get store reference
  const store = useAppStore;

  // Initialize on mount
  useEffect(() => {
    store.getState().initTags();
  }, []);

  const value: TagContextType = {
    // State
    allTags,
    pinnedTags,
    selectedTag,
    tagColors,
    suggestedTags,
    isLoadingSuggestions,

    // Pinned tag operations
    pinTag: store.getState().pinTag,
    unpinTag: store.getState().unpinTag,
    renameTag: store.getState().renameTag,
    deleteTag: store.getState().deleteTag,
    togglePinnedTagCollapsed: store.getState().togglePinnedTagCollapsed,
    reorderPinnedTags: store.getState().reorderPinnedTags,

    // Tag operations
    setSelectedTag: store.getState().setSelectedTag,
    setTagColor: store.getState().setTagColor,
    refreshTags: store.getState().refreshTags,
    fetchSuggestedTags: store.getState().fetchSuggestedTags,
    clearSuggestedTags: store.getState().clearSuggestedTags,

    // Internal methods - now no-ops since store handles everything atomically
    incrementTagCount: () => { },
    decrementTagCount: () => { },
    updateTagInDocuments: () => { },
    removeTagFromAllDocs: () => { },
  };

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
