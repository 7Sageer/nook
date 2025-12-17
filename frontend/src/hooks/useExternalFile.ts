import { useState, useCallback } from 'react';
import { OpenExternalFile, SaveExternalFile } from '../../wailsjs/go/main/App';

export interface ExternalFileInfo {
    path: string;
    name: string;
    content: string;
}

// 从路径中提取文件名
function getFileName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
}

export function useExternalFile() {
    const [externalFile, setExternalFile] = useState<ExternalFileInfo | null>(null);
    const [isExternalActive, setIsExternalActive] = useState(false);

    const openExternal = useCallback(async () => {
        const file = await OpenExternalFile();
        if (file.path) {
            setExternalFile({
                path: file.path,
                name: file.name,
                content: file.content,
            });
            setIsExternalActive(true);
            return file;
        }
        return null;
    }, []);

    // 通过路径打开文件（用于系统打开文件事件）
    const openExternalByPath = useCallback(async (path: string, content: string) => {
        setExternalFile({
            path: path,
            name: getFileName(path),
            content: content,
        });
        setIsExternalActive(true);
    }, []);

    const saveExternal = useCallback(async (content: string) => {
        if (externalFile) {
            await SaveExternalFile(externalFile.path, content);
            setExternalFile((prev) => (prev ? { ...prev, content } : prev));
        }
    }, [externalFile]);

    const activateExternal = useCallback(() => {
        if (externalFile) setIsExternalActive(true);
    }, [externalFile]);

    const deactivateExternal = useCallback(() => {
        setIsExternalActive(false);
    }, []);

    const closeExternal = useCallback(() => {
        setExternalFile(null);
        setIsExternalActive(false);
    }, []);

    return {
        externalFile,
        openExternal,
        openExternalByPath,
        saveExternal,
        activateExternal,
        deactivateExternal,
        closeExternal,
        isExternalMode: isExternalActive,
    };
}
