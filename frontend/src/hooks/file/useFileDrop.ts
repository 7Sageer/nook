import { useEffect } from "react";
import { EventsOn, EventsOff } from "../../../wailsjs/runtime/runtime";
import { insertFileBlock, indexFileBlock, insertFolderBlockWithPath, indexFolderBlock } from "../../utils/editorExtensions";
import { CopyFileToStorage, SaveImage, ReadFileAsBase64 } from "../../../wailsjs/go/main/App";

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
    x: number;
    y: number;
}

interface FolderDroppedData {
    path: string;
    name: string;
    x: number;
    y: number;
}

/**
 * 根据屏幕坐标查找最接近的 block
 * 导出供 Windows HTML5 拖拽使用
 */
export function findBlockNearPosition(editor: EditorInstance, x: number, y: number) {
    try {
        // 获取所有顶层 blocks
        const blocks = editor.document;
        if (!blocks || blocks.length === 0) {
            return editor.getTextCursorPosition().block;
        }

        // 遍历 blocks，找到 y 坐标最接近的
        let closestBlock = blocks[0];
        let minDistance = Infinity;

        for (const block of blocks) {
            const blockEl = document.querySelector(`[data-id="${block.id}"]`);
            if (blockEl) {
                const rect = blockEl.getBoundingClientRect();
                const blockCenterY = rect.top + rect.height / 2;
                const distance = Math.abs(y - blockCenterY);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestBlock = block;
                }
            }
        }

        return closestBlock;
    } catch {
        return editor.getTextCursorPosition().block;
    }
}

/**
 * 判断 MIME 类型是否为图片
 */
function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith("image/");
}

/**
 * 判断 MIME 类型是否为视频
 */
function isVideoMimeType(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

/**
 * 判断 MIME 类型是否为音频
 */
function isAudioMimeType(mimeType: string): boolean {
    return mimeType.startsWith("audio/");
}

/**
 * 插入媒体块（image/video/audio）
 * @param targetBlock 可选的目标 block，如果不提供则使用当前光标位置
 */
function insertMediaBlock(
    editor: EditorInstance,
    type: "image" | "video" | "audio",
    url: string,
    name: string,
    targetBlock?: unknown
) {
    const currentBlock = targetBlock || editor.getTextCursorPosition().block;
    const currentContent = (currentBlock as { content?: unknown[] }).content;

    const isEmptyOrSlash =
        Array.isArray(currentContent) &&
        (currentContent.length === 0 ||
            (currentContent.length === 1 &&
                (currentContent[0] as { type?: string })?.type === "text" &&
                (currentContent[0] as { text?: string })?.text === "/"));

    const mediaProps = {
        url,
        name,
        caption: "",
    };

    const newBlock = isEmptyOrSlash
        ? editor.updateBlock(currentBlock, {
            type,
            props: mediaProps,
        })
        : editor.insertBlocks(
            [{ type, props: mediaProps }],
            currentBlock,
            "after"
        )[0];

    editor.setTextCursorPosition(newBlock);
    return newBlock;
}

/**
 * 监听 Wails 拖拽事件，统一处理文件和文件夹拖拽
 * 根据 MIME 类型分发到不同的 block 类型：
 * - image/* -> 内置 image block（可预览）
 * - video/* -> 内置 video block
 * - audio/* -> 内置 audio block  
 * - 其他 -> 自定义 FileBlock（可索引）
 */
export const useFileDrop = ({ editor, docId }: UseFileDropProps) => {
    useEffect(() => {
        if (!editor) return;

        // 处理文件拖拽 - 根据类型分发
        const handleFileDrop = async (data: FileDroppedData) => {
            console.log('[useFileDrop] file:dropped event received:', data);

            // 验证数据有效性
            if (!data?.path || !data?.name) {
                console.warn('[useFileDrop] Invalid file drop data:', data);
                return;
            }

            const mimeType = data.mimeType || "";
            console.log(`[useFileDrop] Processing file: ${data.name}, mimeType: ${mimeType}`);
            // 根据拖放坐标找到目标 block
            const targetBlock = findBlockNearPosition(editor, data.x, data.y);

            try {
                // 图片类型 - 使用内置 image block
                if (isImageMimeType(mimeType)) {
                    const base64 = await ReadFileAsBase64(data.path);
                    const ext = data.name.split(".").pop() || "png";
                    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const url = await SaveImage(base64, filename);
                    insertMediaBlock(editor, "image", url, data.name, targetBlock);
                    return;
                }

                // 视频类型 - 使用内置 video block
                if (isVideoMimeType(mimeType)) {
                    insertMediaBlock(editor, "video", `file://${data.path}`, data.name, targetBlock);
                    return;
                }

                // 音频类型 - 使用内置 audio block
                if (isAudioMimeType(mimeType)) {
                    insertMediaBlock(editor, "audio", `file://${data.path}`, data.name, targetBlock);
                    return;
                }

                // 其他类型 - 使用 FileBlock（可索引）
                const fileInfo = await CopyFileToStorage(data.path);
                if (fileInfo) {
                    console.log('[useFileDrop] FileBlock created, starting index...');
                    const block = insertFileBlock(editor, fileInfo, targetBlock);
                    // 自动索引 - 后端会自动检测文件是否可索引
                    if (docId) {
                        indexFileBlock(editor, block.id, fileInfo.originalPath, docId, fileInfo.fileName);
                    }
                    console.log('[useFileDrop] FileBlock insert complete, blockId:', block.id);
                }
            } catch (err) {
                console.error('[useFileDrop] Failed to handle file drop:', err);
            }
            console.log('[useFileDrop] handleFileDrop completed');
        };

        // 处理文件夹拖拽
        const handleFolderDrop = async (data: FolderDroppedData) => {
            try {
                // 根据拖放坐标找到目标 block
                const targetBlock = findBlockNearPosition(editor, data.x, data.y);
                const block = insertFolderBlockWithPath(editor, {
                    path: data.path,
                    name: data.name,
                }, targetBlock);
                // 自动索引
                if (docId) {
                    indexFolderBlock(editor, block.id, data.path, docId);
                }
            } catch (err) {
                console.error('Failed to handle folder drop:', err);
            }
        };

        // 注册 Wails 事件监听
        console.log('[useFileDrop] Registering Wails event listeners, docId:', docId);
        EventsOn("file:dropped", handleFileDrop);
        EventsOn("folder:dropped", handleFolderDrop);

        return () => {
            console.log('[useFileDrop] Removing Wails event listeners');
            EventsOff("file:dropped");
            EventsOff("folder:dropped");
        };
    }, [editor, docId]);
};
