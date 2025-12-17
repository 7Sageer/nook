import { useCallback } from 'react';
import { Block, BlockNoteEditor } from '@blocknote/core';
import { ImportMarkdownFile, ExportMarkdownFile } from '../../wailsjs/go/main/App';
import { DocumentMeta } from '../types/document';

interface UseImportExportProps {
    editorRef: React.MutableRefObject<BlockNoteEditor | null>;
    activeId: string | null;
    documents: DocumentMeta[];
    createDoc: (title?: string) => Promise<DocumentMeta>;
    saveContent: (id: string, content: Block[]) => Promise<void>;
    onContentChange?: (content: Block[]) => void;
}

interface UseImportExportReturn {
    handleImport: () => Promise<void>;
    handleExport: () => Promise<void>;
}

export function useImportExport({
    editorRef,
    activeId,
    documents,
    createDoc,
    saveContent,
    onContentChange,
}: UseImportExportProps): UseImportExportReturn {
    const handleImport = useCallback(async () => {
        const markdown = await ImportMarkdownFile();
        if (markdown && editorRef.current) {
            try {
                const blocks = await editorRef.current.tryParseMarkdownToBlocks(markdown);
                const doc = await createDoc('导入的文档');
                await saveContent(doc.id, blocks);
                onContentChange?.(blocks);
            } catch (e) {
                console.error('导入失败:', e);
            }
        }
    }, [editorRef, createDoc, saveContent, onContentChange]);

    const handleExport = useCallback(async () => {
        if (editorRef.current && activeId) {
            try {
                const markdown = await editorRef.current.blocksToMarkdownLossy();
                const activeDoc = documents.find((d) => d.id === activeId);
                await ExportMarkdownFile(markdown, activeDoc?.title || 'document');
            } catch (e) {
                console.error('导出失败:', e);
            }
        }
    }, [editorRef, activeId, documents]);

    return {
        handleImport,
        handleExport,
    };
}
