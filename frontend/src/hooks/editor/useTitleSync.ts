import { useRef, useCallback } from 'react';
import { Block } from '@blocknote/core';
import { extractDocumentTitle } from '../../utils/blockUtils';
import { DocumentMeta } from '../../types/document';

interface UseTitleSyncOptions {
    activeId: string | null;
    documents: DocumentMeta[];
    renameDoc: (id: string, title: string) => void;
}

/**
 * Hook for automatically syncing the first H1 heading as the document title.
 * Includes debouncing to avoid excessive renames.
 */
export function useTitleSync({
    activeId,
    documents,
    renameDoc,
}: UseTitleSyncOptions) {
    const titleSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSyncedTitleRef = useRef<string | null>(null);

    const resetTitleSync = useCallback(() => {
        lastSyncedTitleRef.current = null;
    }, []);

    const syncTitleFromBlocks = useCallback((blocks: Block[]) => {
        if (!activeId) return;

        const title = extractDocumentTitle(blocks);
        if (title && title !== lastSyncedTitleRef.current) {
            // 清除之前的定时器
            if (titleSyncTimerRef.current) {
                clearTimeout(titleSyncTimerRef.current);
            }
            // 设置新的防抖定时器
            titleSyncTimerRef.current = setTimeout(() => {
                const currentDoc = documents.find(d => d.id === activeId);
                if (currentDoc && title !== currentDoc.title) {
                    renameDoc(activeId, title);
                    lastSyncedTitleRef.current = title;
                }
            }, 500);
        }
    }, [activeId, documents, renameDoc]);

    return {
        syncTitleFromBlocks,
        resetTitleSync,
    };
}
