import { useState, useCallback } from 'react';
import { OpenExternalFile, SaveExternalFile } from '../../wailsjs/go/main/App';

export interface ExternalFileInfo {
    path: string;
    name: string;
    content: string;
}

// 从路径中提取文件名
function getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
}

export function useExternalFile() {
    const [externalFile, setExternalFile] = useState<ExternalFileInfo | null>(null);

    const openExternal = useCallback(async () => {
        const file = await OpenExternalFile();
        if (file.path) {
            setExternalFile({
                path: file.path,
                name: file.name,
                content: file.content,
            });
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
    }, []);

    const saveExternal = useCallback(async (content: string) => {
        if (externalFile) {
            await SaveExternalFile(externalFile.path, content);
        }
    }, [externalFile]);

    const closeExternal = useCallback(() => {
        setExternalFile(null);
    }, []);

    return {
        externalFile,
        openExternal,
        openExternalByPath,
        saveExternal,
        closeExternal,
        isExternalMode: externalFile !== null,
    };
}
