import { useState, useEffect, useCallback } from 'react';
import { Folder } from '../types/document';
import {
    GetFolders,
    CreateFolder,
    DeleteFolder,
    RenameFolder,
    SetFolderCollapsed,
    MoveDocumentToFolder,
} from '../../wailsjs/go/main/App';

export function useFolders() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 加载文件夹列表
    const loadFolders = useCallback(async () => {
        try {
            const data = await GetFolders();
            setFolders(data || []);
        } catch (e) {
            console.error('加载文件夹失败:', e);
            setFolders([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFolders();
    }, [loadFolders]);

    // 创建文件夹
    const createFolder = useCallback(async (name?: string) => {
        try {
            const folder = await CreateFolder(name || '');
            setFolders((prev) => [folder, ...prev]);
            return folder;
        } catch (e) {
            console.error('创建文件夹失败:', e);
            return null;
        }
    }, []);

    // 删除文件夹
    const deleteFolder = useCallback(async (id: string) => {
        try {
            await DeleteFolder(id);
            setFolders((prev) => prev.filter((f) => f.id !== id));
        } catch (e) {
            console.error('删除文件夹失败:', e);
        }
    }, []);

    // 重命名文件夹
    const renameFolder = useCallback(async (id: string, newName: string) => {
        try {
            await RenameFolder(id, newName);
            setFolders((prev) =>
                prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
            );
        } catch (e) {
            console.error('重命名文件夹失败:', e);
        }
    }, []);

    // 切换折叠状态
    const toggleCollapsed = useCallback(async (id: string) => {
        const folder = folders.find((f) => f.id === id);
        if (!folder) return;

        const newCollapsed = !folder.collapsed;
        try {
            await SetFolderCollapsed(id, newCollapsed);
            setFolders((prev) =>
                prev.map((f) => (f.id === id ? { ...f, collapsed: newCollapsed } : f))
            );
        } catch (e) {
            console.error('切换折叠状态失败:', e);
        }
    }, [folders]);

    // 移动文档到文件夹
    const moveDocument = useCallback(async (docId: string, folderId: string) => {
        try {
            await MoveDocumentToFolder(docId, folderId);
            return true;
        } catch (e) {
            console.error('移动文档失败:', e);
            return false;
        }
    }, []);

    return {
        folders,
        isLoading,
        createFolder,
        deleteFolder,
        renameFolder,
        toggleCollapsed,
        moveDocument,
        refreshFolders: loadFolders,
    };
}
