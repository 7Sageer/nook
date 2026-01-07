import { useCallback } from 'react';
import type { Block } from '@blocknote/core';
import type { ExternalFileInfo } from '../../types/external-file';

interface UseExternalFileHandlerOptions {
    externalFiles: ExternalFileInfo[];
    openExternal: () => Promise<ExternalFileInfo | null>;
    openExternalByPath: (path: string, content: string) => void;
    activateExternal: (path?: string) => void;
    parseMarkdownToBlocks: (md: string) => Promise<Block[]>;
    setContent: (blocks: Block[]) => void;
    setContentLoading: (loading: boolean) => void;
    setEditorKey: (key: string) => void;
}

/**
 * Hook to handle external file operations (open, switch).
 * Extracts external file handling logic from App.tsx.
 */
export function useExternalFileHandler({
    externalFiles,
    openExternal,
    openExternalByPath,
    activateExternal,
    parseMarkdownToBlocks,
    setContent,
    setContentLoading,
    setEditorKey,
}: UseExternalFileHandlerOptions) {
    // Open external file via file picker
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
            const { LoadExternalFile } = await import('../../../wailsjs/go/main/App');
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
        handleOpenExternal,
        handleSwitchToExternal,
    };
}
