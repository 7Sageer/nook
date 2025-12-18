import { useState, useCallback, useMemo } from 'react';
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
    const [externalFiles, setExternalFiles] = useState<ExternalFileInfo[]>([]);
    const [activeExternalPath, setActiveExternalPath] = useState<string | null>(null);

    // 派生：当前活动的外部文件
    const activeExternalFile = useMemo(() => {
        if (!activeExternalPath) return null;
        return externalFiles.find(f => f.path === activeExternalPath) || null;
    }, [externalFiles, activeExternalPath]);

    // 是否处于外部文件模式
    const isExternalMode = activeExternalPath !== null;

    // 通过文件对话框打开文件
    const openExternal = useCallback(async () => {
        const file = await OpenExternalFile();
        if (file.path) {
            // 检查是否已存在
            setExternalFiles(prev => {
                const exists = prev.some(f => f.path === file.path);
                if (exists) {
                    // 已存在，更新内容并激活
                    return prev.map(f => f.path === file.path ? {
                        path: file.path,
                        name: file.name,
                        content: file.content,
                    } : f);
                }
                // 新文件，添加到列表
                return [...prev, {
                    path: file.path,
                    name: file.name,
                    content: file.content,
                }];
            });
            setActiveExternalPath(file.path);
            return file;
        }
        return null;
    }, []);

    // 通过路径打开文件（用于系统打开文件事件）
    const openExternalByPath = useCallback(async (path: string, content: string) => {
        const name = getFileName(path);
        setExternalFiles(prev => {
            const exists = prev.some(f => f.path === path);
            if (exists) {
                // 已存在，更新内容
                return prev.map(f => f.path === path ? { path, name, content } : f);
            }
            // 新文件，添加到列表
            return [...prev, { path, name, content }];
        });
        setActiveExternalPath(path);
    }, []);

    // 保存当前活动的外部文件
    const saveExternal = useCallback(async (content: string) => {
        if (activeExternalPath) {
            await SaveExternalFile(activeExternalPath, content);
            setExternalFiles(prev =>
                prev.map(f => f.path === activeExternalPath ? { ...f, content } : f)
            );
        }
    }, [activeExternalPath]);

    // 激活指定的外部文件
    const activateExternal = useCallback((path?: string) => {
        if (path) {
            // 激活指定路径
            const exists = externalFiles.some(f => f.path === path);
            if (exists) {
                setActiveExternalPath(path);
            }
        } else if (externalFiles.length > 0 && !activeExternalPath) {
            // 自动激活第一个
            setActiveExternalPath(externalFiles[0].path);
        }
    }, [externalFiles, activeExternalPath]);

    // 退出外部文件模式（切换到内部文档）
    const deactivateExternal = useCallback(() => {
        setActiveExternalPath(null);
    }, []);

    // 关闭指定的外部文件
    const closeExternal = useCallback((path?: string) => {
        const targetPath = path || activeExternalPath;
        if (!targetPath) return;

        setExternalFiles(prev => prev.filter(f => f.path !== targetPath));

        // 如果关闭的是当前活动文件，切换到其他文件或退出外部模式
        if (targetPath === activeExternalPath) {
            setExternalFiles(prev => {
                const remaining = prev.filter(f => f.path !== targetPath);
                if (remaining.length > 0) {
                    // 切换到第一个剩余文件
                    setActiveExternalPath(remaining[0].path);
                } else {
                    // 没有剩余文件，退出外部模式
                    setActiveExternalPath(null);
                }
                return remaining;
            });
        }
    }, [activeExternalPath]);

    return {
        externalFiles,
        activeExternalFile,
        activeExternalPath,
        openExternal,
        openExternalByPath,
        saveExternal,
        activateExternal,
        deactivateExternal,
        closeExternal,
        isExternalMode,
    };
}
