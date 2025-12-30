import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { OpenExternalFile, SaveExternalFile, LoadExternalFile } from '../../wailsjs/go/handlers/FileHandler';
import type { Block } from '@blocknote/core';

// ========== Types ==========

export interface ExternalFileInfo {
    path: string;
    name: string;
    content: string;
}

interface ExternalFileContextType {
    // State
    externalFiles: ExternalFileInfo[];
    activeExternalFile: ExternalFileInfo | null;
    activeExternalPath: string | null;
    isExternalMode: boolean;

    // Actions
    openExternal: () => Promise<ExternalFileInfo | null>;
    openExternalByPath: (path: string, content: string) => Promise<void>;
    saveExternal: (content: string) => Promise<void>;
    activateExternal: (path?: string) => void;
    deactivateExternal: () => void;
    closeExternal: (path?: string) => void;
}

const ExternalFileContext = createContext<ExternalFileContextType | undefined>(undefined);

// ========== Helpers ==========

function getFileName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
}

// ========== Provider ==========

export function ExternalFileProvider({ children }: { children: ReactNode }) {
    const [externalFiles, setExternalFiles] = useState<ExternalFileInfo[]>([]);
    const [activeExternalPath, setActiveExternalPath] = useState<string | null>(null);

    // Derived: current active external file
    const activeExternalFile = useMemo(() => {
        if (!activeExternalPath) return null;
        return externalFiles.find(f => f.path === activeExternalPath) || null;
    }, [externalFiles, activeExternalPath]);

    // Is in external file mode
    const isExternalMode = activeExternalPath !== null;

    // Open file via dialog
    const openExternal = useCallback(async (): Promise<ExternalFileInfo | null> => {
        const file = await OpenExternalFile();
        if (file.path) {
            setExternalFiles(prev => {
                const exists = prev.some(f => f.path === file.path);
                if (exists) {
                    return prev.map(f => f.path === file.path ? {
                        path: file.path,
                        name: file.name,
                        content: file.content,
                    } : f);
                }
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

    // Open file by path (for system open events)
    const openExternalByPath = useCallback(async (path: string, content: string) => {
        const name = getFileName(path);
        setExternalFiles(prev => {
            const exists = prev.some(f => f.path === path);
            if (exists) {
                return prev.map(f => f.path === path ? { path, name, content } : f);
            }
            return [...prev, { path, name, content }];
        });
        setActiveExternalPath(path);
    }, []);

    // Save current active external file
    const saveExternal = useCallback(async (content: string) => {
        if (activeExternalPath) {
            await SaveExternalFile(activeExternalPath, content);
            setExternalFiles(prev =>
                prev.map(f => f.path === activeExternalPath ? { ...f, content } : f)
            );
        }
    }, [activeExternalPath]);

    // Activate specified external file
    const activateExternal = useCallback((path?: string) => {
        if (path) {
            const exists = externalFiles.some(f => f.path === path);
            if (exists) {
                setActiveExternalPath(path);
            }
        } else if (externalFiles.length > 0 && !activeExternalPath) {
            setActiveExternalPath(externalFiles[0].path);
        }
    }, [externalFiles, activeExternalPath]);

    // Deactivate (switch back to internal documents)
    const deactivateExternal = useCallback(() => {
        setActiveExternalPath(null);
    }, []);

    // Close external file
    const closeExternal = useCallback((path?: string) => {
        const targetPath = path || activeExternalPath;
        if (!targetPath) return;

        setExternalFiles(prev => prev.filter(f => f.path !== targetPath));

        if (targetPath === activeExternalPath) {
            setExternalFiles(prev => {
                const remaining = prev.filter(f => f.path !== targetPath);
                if (remaining.length > 0) {
                    setActiveExternalPath(remaining[0].path);
                } else {
                    setActiveExternalPath(null);
                }
                return remaining;
            });
        }
    }, [activeExternalPath]);

    const value: ExternalFileContextType = {
        externalFiles,
        activeExternalFile,
        activeExternalPath,
        isExternalMode,
        openExternal,
        openExternalByPath,
        saveExternal,
        activateExternal,
        deactivateExternal,
        closeExternal,
    };

    return (
        <ExternalFileContext.Provider value={value}>
            {children}
        </ExternalFileContext.Provider>
    );
}

// ========== Hook ==========

export function useExternalFileContext() {
    const context = useContext(ExternalFileContext);
    if (!context) {
        throw new Error('useExternalFileContext must be used within ExternalFileProvider');
    }
    return context;
}
