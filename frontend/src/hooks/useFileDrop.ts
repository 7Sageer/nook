import { useEffect } from "react";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { insertFileBlock, indexFileBlock, insertFolderBlockWithPath, indexFolderBlock } from "../utils/editorExtensions";
import { CopyFileToStorage } from "../../wailsjs/go/main/App";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

interface UseFileDropProps {
    editor: EditorInstance;
    docId?: string;
}

// Wails 事件数据类型
interface FileDroppedData {
    path: string;
    name: string;
    size: number;
    mimeType: string;
}

interface FolderDroppedData {
    path: string;
    name: string;
}

/**
 * 监听 Wails 拖拽事件，统一处理文件和文件夹拖拽
 * 注意：不再在前端过滤文件类型，让后端索引时自动检测是否为文本文件
 */
export const useFileDrop = ({ editor, docId }: UseFileDropProps) => {
    useEffect(() => {
        if (!editor) return;

        // 处理文件拖拽 - 接受所有文件类型
        const handleFileDrop = async (data: FileDroppedData) => {
            // 验证数据有效性
            if (!data?.path || !data?.name) {
                console.warn('[useFileDrop] Invalid file drop data:', data);
                return;
            }

            try {
                // 调用 Go 端获取文件信息（引用模式，不复制文件）
                const fileInfo = await CopyFileToStorage(data.path);
                if (fileInfo) {
                    const block = insertFileBlock(editor, fileInfo);
                    // 自动索引 - 后端会自动检测文件是否可索引
                    if (docId) {
                        indexFileBlock(editor, block.id, fileInfo.originalPath, docId);
                    }
                }
            } catch (err) {
                console.error('Failed to handle file drop:', err);
            }
        };

        // 处理文件夹拖拽
        const handleFolderDrop = async (data: FolderDroppedData) => {
            try {
                const block = insertFolderBlockWithPath(editor, {
                    path: data.path,
                    name: data.name,
                });
                // 自动索引
                if (docId) {
                    indexFolderBlock(editor, block.id, data.path, docId);
                }
            } catch (err) {
                console.error('Failed to handle folder drop:', err);
            }
        };

        // 注册 Wails 事件监听
        EventsOn("file:dropped", handleFileDrop);
        EventsOn("folder:dropped", handleFolderDrop);

        return () => {
            EventsOff("file:dropped");
            EventsOff("folder:dropped");
        };
    }, [editor, docId]);
};
