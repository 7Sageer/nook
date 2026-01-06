/**
 * Unified App Store using Zustand
 * 
 * This store manages the shared state between documents and tags,
 * eliminating the circular dependency between DocumentContext and TagContext.
 */

import { create } from 'zustand';
import { DocumentMeta, TagInfo, TagSuggestion } from '../types/document';
import { Block } from '@blocknote/core';
import {
    GetDocumentList,
    CreateDocument,
    DeleteDocument,
    RenameDocument as RenameDocumentApi,
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
    RenameTag as RenameTagApi,
    DeleteTag as DeleteTagApi,
    SuggestTags,
} from '../../wailsjs/go/main/App';

// ========== State Types ==========

interface DocumentState {
    documents: DocumentMeta[];
    activeId: string | null;
    isLoading: boolean;
}

interface TagState {
    allTags: TagInfo[];
    pinnedTags: TagInfo[];
    selectedTag: string | null;
    tagColors: Record<string, string>;
    suggestedTags: TagSuggestion[];
    isLoadingSuggestions: boolean;
}

interface AppState extends DocumentState, TagState {
    // ========== Initialization ==========
    initDocuments: () => Promise<void>;
    initTags: () => Promise<void>;

    // ========== Document Actions ==========
    createDoc: (title: string, pinnedTagName?: string) => Promise<DocumentMeta>;
    deleteDoc: (id: string) => Promise<void>;
    renameDoc: (id: string, newTitle: string) => Promise<void>;
    switchDoc: (id: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
    refreshDocuments: () => Promise<void>;
    loadContent: (id: string) => Promise<Block[] | undefined>;
    saveContent: (id: string, content: Block[]) => Promise<void>;

    // ========== Document Tag Actions (updates both document and tag counts) ==========
    addTagToDoc: (docId: string, tag: string) => Promise<void>;
    removeTagFromDoc: (docId: string, tag: string) => Promise<void>;

    // ========== Tag Actions ==========
    pinTag: (name: string) => Promise<void>;
    unpinTag: (name: string) => Promise<void>;
    renameTag: (oldName: string, newName: string) => Promise<void>;
    deleteTag: (name: string) => Promise<void>;
    togglePinnedTagCollapsed: (name: string) => Promise<void>;
    reorderPinnedTags: (names: string[]) => Promise<void>;
    setSelectedTag: (tag: string | null) => void;
    setTagColor: (tagName: string, color: string) => Promise<void>;
    refreshTags: () => Promise<void>;
    fetchSuggestedTags: (docId: string) => Promise<void>;
    clearSuggestedTags: () => void;
}

// ========== Store Implementation ==========

export const useAppStore = create<AppState>((set, get) => ({
    // Initial document state
    documents: [],
    activeId: null,
    isLoading: true,

    // Initial tag state
    allTags: [],
    pinnedTags: [],
    selectedTag: null,
    tagColors: {},
    suggestedTags: [],
    isLoadingSuggestions: false,

    // ========== Initialization ==========

    initDocuments: async () => {
        try {
            const index = await GetDocumentList();
            set({
                documents: index.documents || [],
                activeId: index.activeId || null,
                isLoading: false,
            });
        } catch (e) {
            console.error('Failed to initialize documents:', e);
            set({ isLoading: false });
        }
    },

    initTags: async () => {
        try {
            const [tags, pinned, colors] = await Promise.all([
                GetAllTags(),
                GetPinnedTags(),
                GetTagColors(),
            ]);
            set({
                allTags: tags || [],
                pinnedTags: pinned || [],
                tagColors: colors || {},
            });
        } catch (e) {
            console.error('Failed to initialize tags:', e);
        }
    },

    // ========== Document Actions ==========

    createDoc: async (title, pinnedTagName) => {
        const doc = await CreateDocument(title);
        if (pinnedTagName) {
            await AddDocumentTag(doc.id, pinnedTagName);
            doc.tags = [pinnedTagName];
        }
        set((state) => ({
            documents: [doc, ...state.documents],
            activeId: doc.id,
        }));
        return doc;
    },

    deleteDoc: async (id) => {
        await DeleteDocument(id);
        set((state) => {
            const remaining = state.documents.filter((d) => d.id !== id);
            const newActiveId = state.activeId === id
                ? (remaining.length > 0 ? remaining[0].id : null)
                : state.activeId;
            return { documents: remaining, activeId: newActiveId };
        });
    },

    renameDoc: async (id, newTitle) => {
        await RenameDocumentApi(id, newTitle);
        set((state) => ({
            documents: state.documents.map((d) =>
                d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d
            ),
        }));
    },

    switchDoc: async (id) => {
        await SetActiveDocument(id);
        set({ activeId: id });
    },

    reorderDocuments: async (ids) => {
        await ReorderDocuments(ids);
        set((state) => {
            const orderMap = new Map(ids.map((id, index) => [id, index]));
            const sorted = [...state.documents]
                .map((d) => ({ ...d, order: orderMap.get(d.id) ?? d.order }))
                .sort((a, b) => a.order - b.order);
            return { documents: sorted };
        });
    },

    refreshDocuments: async () => {
        try {
            const index = await GetDocumentList();
            set((state) => ({
                documents: index.documents || [],
                activeId: (index.documents || []).some((d) => d.id === state.activeId)
                    ? state.activeId
                    : (index.activeId || null),
            }));
        } catch (e) {
            console.error('Failed to refresh documents:', e);
        }
    },

    loadContent: async (id) => {
        const content = await LoadDocumentContent(id);
        if (content) {
            try {
                return JSON.parse(content);
            } catch {
                return undefined;
            }
        }
        return undefined;
    },

    saveContent: async (id, content) => {
        await SaveDocumentContent(id, JSON.stringify(content));
    },

    // ========== Document Tag Actions ==========
    // These update both document.tags AND tag counts atomically

    addTagToDoc: async (docId, tag) => {
        await AddDocumentTag(docId, tag);
        set((state) => {
            // Update document
            const newDocs = state.documents.map((d) =>
                d.id === docId
                    ? { ...d, tags: [...(d.tags || []), tag], updatedAt: Date.now() }
                    : d
            );

            // Update tag count
            const existingTag = state.allTags.find((t) => t.name === tag);
            const newTags = existingTag
                ? state.allTags.map((t) =>
                    t.name === tag ? { ...t, count: t.count + 1 } : t
                )
                : [...state.allTags, { name: tag, count: 1 }];

            return { documents: newDocs, allTags: newTags };
        });
    },

    removeTagFromDoc: async (docId, tag) => {
        await RemoveDocumentTag(docId, tag);
        set((state) => {
            // Update document
            const newDocs = state.documents.map((d) =>
                d.id === docId
                    ? { ...d, tags: (d.tags || []).filter((t) => t !== tag), updatedAt: Date.now() }
                    : d
            );

            // Update tag count (remove if count reaches 0 and not pinned)
            const existingTag = state.allTags.find((t) => t.name === tag);
            let newTags: TagInfo[];
            if (existingTag?.isPinned) {
                newTags = state.allTags.map((t) =>
                    t.name === tag ? { ...t, count: Math.max(0, t.count - 1) } : t
                );
            } else if (existingTag && existingTag.count > 1) {
                newTags = state.allTags.map((t) =>
                    t.name === tag ? { ...t, count: t.count - 1 } : t
                );
            } else {
                newTags = state.allTags.filter((t) => t.name !== tag);
            }

            return { documents: newDocs, allTags: newTags };
        });
    },

    // ========== Tag Actions ==========

    pinTag: async (name) => {
        await PinTag(name);
        set((state) => ({
            pinnedTags: [
                ...state.pinnedTags,
                { name, count: 0, isPinned: true, collapsed: false, order: state.pinnedTags.length },
            ],
            allTags: state.allTags.map((t) =>
                t.name === name ? { ...t, isPinned: true } : t
            ),
        }));
    },

    unpinTag: async (name) => {
        await UnpinTag(name);
        set((state) => ({
            pinnedTags: state.pinnedTags.filter((t) => t.name !== name),
            allTags: state.allTags.map((t) =>
                t.name === name ? { ...t, isPinned: false } : t
            ),
        }));
    },

    renameTag: async (oldName, newName) => {
        await RenameTagApi(oldName, newName);
        set((state) => ({
            pinnedTags: state.pinnedTags.map((t) =>
                t.name === oldName ? { ...t, name: newName } : t
            ),
            allTags: state.allTags.map((t) =>
                t.name === oldName ? { ...t, name: newName } : t
            ),
            // Also update documents with this tag
            documents: state.documents.map((d) => ({
                ...d,
                tags: (d.tags || []).map((t) => (t === oldName ? newName : t)),
            })),
        }));
    },

    deleteTag: async (name) => {
        await DeleteTagApi(name);
        set((state) => ({
            pinnedTags: state.pinnedTags.filter((t) => t.name !== name),
            allTags: state.allTags.filter((t) => t.name !== name),
            // Also remove from all documents
            documents: state.documents.map((d) => ({
                ...d,
                tags: (d.tags || []).filter((t) => t !== name),
            })),
        }));
    },

    togglePinnedTagCollapsed: async (name) => {
        const { pinnedTags } = get();
        const currentTag = pinnedTags.find((t) => t.name === name);
        if (!currentTag) return;

        const nextCollapsed = !(currentTag.collapsed ?? false);
        set((state) => ({
            pinnedTags: state.pinnedTags.map((t) =>
                t.name === name ? { ...t, collapsed: nextCollapsed } : t
            ),
        }));

        try {
            await SetPinnedTagCollapsed(name, nextCollapsed);
        } catch (e) {
            // Rollback on error
            set((state) => ({
                pinnedTags: state.pinnedTags.map((t) =>
                    t.name === name ? { ...t, collapsed: !nextCollapsed } : t
                ),
            }));
            console.error('Failed to toggle pinned tag collapsed:', e);
        }
    },

    reorderPinnedTags: async (names) => {
        await ReorderPinnedTags(names);
        set((state) => {
            const orderMap = new Map(names.map((name, index) => [name, index]));
            const sorted = [...state.pinnedTags]
                .map((t) => ({ ...t, order: orderMap.get(t.name) ?? t.order }))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            return { pinnedTags: sorted };
        });
    },

    setSelectedTag: (tag) => set({ selectedTag: tag }),

    setTagColor: async (tagName, color) => {
        await SetTagColor(tagName, color);
        set((state) => ({
            tagColors: { ...state.tagColors, [tagName]: color },
            allTags: state.allTags.map((t) =>
                t.name === tagName ? { ...t, color } : t
            ),
        }));
    },

    refreshTags: async () => {
        const [tags, pinned, colors] = await Promise.all([
            GetAllTags(),
            GetPinnedTags(),
            GetTagColors(),
        ]);
        set({
            allTags: tags || [],
            pinnedTags: pinned || [],
            tagColors: colors || {},
        });
    },

    fetchSuggestedTags: async (docId) => {
        set({ isLoadingSuggestions: true });
        try {
            const suggestions = await SuggestTags(docId);
            set({ suggestedTags: suggestions || [], isLoadingSuggestions: false });
        } catch (e) {
            console.error('Failed to fetch suggested tags:', e);
            set({ suggestedTags: [], isLoadingSuggestions: false });
        }
    },

    clearSuggestedTags: () => set({ suggestedTags: [] }),
}));

// ========== Selector Hooks for Optimized Re-renders ==========

// Document selectors
export const useDocuments = () => useAppStore((state) => state.documents);
export const useActiveId = () => useAppStore((state) => state.activeId);
export const useIsLoading = () => useAppStore((state) => state.isLoading);

// Tag selectors
export const useAllTags = () => useAppStore((state) => state.allTags);
export const usePinnedTags = () => useAppStore((state) => state.pinnedTags);
export const useSelectedTag = () => useAppStore((state) => state.selectedTag);
export const useTagColors = () => useAppStore((state) => state.tagColors);
export const useSuggestedTags = () => useAppStore((state) => state.suggestedTags);
export const useIsLoadingSuggestions = () => useAppStore((state) => state.isLoadingSuggestions);

// Action selectors (stable references, no re-renders on state change)
export const useDocumentActions = () => useAppStore((state) => ({
    createDoc: state.createDoc,
    deleteDoc: state.deleteDoc,
    renameDoc: state.renameDoc,
    switchDoc: state.switchDoc,
    reorderDocuments: state.reorderDocuments,
    refreshDocuments: state.refreshDocuments,
    loadContent: state.loadContent,
    saveContent: state.saveContent,
    addTagToDoc: state.addTagToDoc,
    removeTagFromDoc: state.removeTagFromDoc,
}));

export const useTagActions = () => useAppStore((state) => ({
    pinTag: state.pinTag,
    unpinTag: state.unpinTag,
    renameTag: state.renameTag,
    deleteTag: state.deleteTag,
    togglePinnedTagCollapsed: state.togglePinnedTagCollapsed,
    reorderPinnedTags: state.reorderPinnedTags,
    setSelectedTag: state.setSelectedTag,
    setTagColor: state.setTagColor,
    refreshTags: state.refreshTags,
    fetchSuggestedTags: state.fetchSuggestedTags,
    clearSuggestedTags: state.clearSuggestedTags,
}));

export const useInitActions = () => useAppStore((state) => ({
    initDocuments: state.initDocuments,
    initTags: state.initTags,
}));
