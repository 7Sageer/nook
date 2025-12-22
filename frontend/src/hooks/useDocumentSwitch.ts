import { useCallback } from 'react';
import { Block } from '@blocknote/core';
import { useExternalFileContext } from '../contexts/ExternalFileContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { MutableRefObject } from 'react';
import type { BlockNoteEditor } from '@blocknote/core';

interface UseDocumentSwitchOptions {
    editorRef: MutableRefObject<BlockNoteEditor | null>;
    parseMarkdownToBlocks: (markdown: string) => Promise<Block[]>;
    setContent: (blocks: Block[]) => void;
    setContentLoading: (loading: boolean) => void;
    setEditorKey: (key: string) => void;
}

export function useDocumentSwitch({
    editorRef,
    parseMarkdownToBlocks,
    setContent,
    setContentLoading,
    setEditorKey,
}: UseDocumentSwitchOptions) {
    const {
        externalFiles,
        openExternal,
        openExternalByPath,
        activateExternal,
        deactivateExternal,
    } = useExternalFileContext();

    const { switchDoc, createDoc } = useDocumentContext();

    // Switch to an internal document
    const handleSwitchToInternal = useCallback((id: string) => {
        deactivateExternal();
        switchDoc(id);
    }, [deactivateExternal, switchDoc]);

    // Create a new internal document
    const handleCreateInternalDocument = useCallback(() => {
        deactivateExternal();
        createDoc();
    }, [createDoc, deactivateExternal]);

    // Open external file via dialog
    const handleOpenExternal = useCallback(async () => {
        const file = await openExternal();
        if (!file) return;

        setContentLoading(true);
        try {
            const blocks = await parseMarkdownToBlocks(file.content);
            setContent(blocks);
            setEditorKey(`external-${file.path}`);
            activateExternal();
        } catch (e) {
            console.error('解析文件失败:', e);
            setEditorKey(`external-${file.path}`);
            activateExternal();
        } finally {
            setContentLoading(false);
        }
    }, [activateExternal, openExternal, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

    // Switch to an already-opened external file
    const handleSwitchToExternal = useCallback(async (path: string) => {
        const file = externalFiles.find(f => f.path === path);
        if (!file) return;

        setContentLoading(true);
        try {
            const { LoadExternalFile } = await import('../../wailsjs/go/main/App');
            const fileContent = await LoadExternalFile(file.path);

            openExternalByPath(file.path, fileContent);
            const blocks = await parseMarkdownToBlocks(fileContent);
            setContent(blocks);
            setEditorKey(`external-${file.path}`);
            activateExternal(file.path);
        } catch (e) {
            console.error('打开外部文件失败:', e);
        } finally {
            setContentLoading(false);
        }
    }, [activateExternal, externalFiles, openExternalByPath, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

    return {
        handleSwitchToInternal,
        handleSwitchToExternal,
        handleCreateInternalDocument,
        handleOpenExternal,
    };
}
