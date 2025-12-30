import { useCallback } from 'react';
import { Block, BlockNoteEditor } from '@blocknote/core';
import { ImportMarkdownFile } from '../../wailsjs/go/main/App';
import { DocumentMeta } from '../types/document';

interface UseImportProps {
    editorRef: React.MutableRefObject<BlockNoteEditor | null>;
    createDoc: (title?: string) => Promise<DocumentMeta>;
    saveContent: (id: string, content: Block[]) => Promise<void>;
    onContentChange?: (content: Block[]) => void;
}

interface UseImportReturn {
    handleImport: () => Promise<void>;
}

/**
 * Hook for importing Markdown files
 */
export function useImport({
    editorRef,
    createDoc,
    saveContent,
    onContentChange,
}: UseImportProps): UseImportReturn {
    const handleImport = useCallback(async () => {
        const result = await ImportMarkdownFile();
        if (result && result.content && editorRef.current) {
            try {
                const blocks = await editorRef.current.tryParseMarkdownToBlocks(result.content);
                const doc = await createDoc(result.fileName);
                await saveContent(doc.id, blocks);
                onContentChange?.(blocks);
            } catch (e) {
                console.error('Import failed:', e);
            }
        }
    }, [editorRef, createDoc, saveContent, onContentChange]);

    return {
        handleImport,
    };
}
