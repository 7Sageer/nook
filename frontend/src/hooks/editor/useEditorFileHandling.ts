import { useEffect, RefObject, useState } from "react";
import { useFileDrop, findBlockNearPosition } from "../file/useFileDrop";
import { SaveFile } from "../../../wailsjs/go/main/App";
import { insertFileBlock, indexFileBlock } from "../../utils/editorExtensions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

interface UseEditorFileHandlingProps {
    editor: EditorInstance;
    docId?: string;
    containerRef: RefObject<HTMLElement>;
}

/**
 * 检测当前是否为 Windows 平台
 * 在 Windows 上 Wails 的 OnFileDrop 无法工作（WebView2 拦截了拖拽事件）
 */
function isWindows(): boolean {
    return navigator.userAgent.includes("Windows");
}

/**
 * 将 File 对象转换为 base64 字符串
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // 移除 data:xxx;base64, 前缀
            const base64 = result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function useEditorFileHandling({ editor, docId, containerRef }: UseEditorFileHandlingProps) {
    const [isWindowsPlatform] = useState(() => isWindows());

    // Handle Wails file drop events (works on macOS/Linux, not on Windows)
    useFileDrop({ editor, docId });

    // Windows fallback: Use HTML5 drag-drop API
    // On Windows, WebView2 intercepts drag events and Wails OnFileDrop never fires
    useEffect(() => {
        if (!isWindowsPlatform) return;

        const container = containerRef.current;
        if (!container || !editor) return;

        const handleDragOver = (event: DragEvent) => {
            if (event.dataTransfer?.types?.includes("Files")) {
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = "copy";
                }
            }
        };

        const handleDrop = async (event: DragEvent) => {
            if (!event.dataTransfer?.types?.includes("Files")) return;

            event.preventDefault();
            event.stopPropagation();

            const files = event.dataTransfer.files;
            if (files.length === 0) return;

            // 根据拖放坐标找到目标 block
            const targetBlock = findBlockNearPosition(editor, event.clientX, event.clientY);

            // 处理第一个文件
            const file = files[0];
            console.log("[Windows FileDrop] Processing file:", file.name, file.size);

            try {
                // 将文件转换为 base64 并保存到存储
                const base64Data = await fileToBase64(file);
                const fileInfo = await SaveFile(base64Data, file.name);

                if (fileInfo) {
                    console.log("[Windows FileDrop] File saved:", fileInfo);

                    // 设置归档标志（因为文件已复制到应用存储）
                    const enrichedFileInfo = {
                        ...fileInfo,
                        archived: true,
                        archivedPath: fileInfo.filePath,
                        archivedAt: Math.floor(Date.now() / 1000),
                        originalPath: file.name, // HTML5 API 无法获取原始路径
                    };

                    const block = insertFileBlock(editor, enrichedFileInfo, targetBlock);

                    // 自动索引
                    if (docId && block?.id) {
                        // 对于归档文件，使用归档路径进行索引，传递原始文件名
                        indexFileBlock(editor, block.id, enrichedFileInfo.archivedPath, docId, file.name);
                    }
                }
            } catch (err) {
                console.error("[Windows FileDrop] Failed to handle file:", err);
            }
        };

        // 添加事件监听
        container.addEventListener("dragover", handleDragOver, { capture: true });
        container.addEventListener("drop", handleDrop, { capture: true });

        return () => {
            container.removeEventListener("dragover", handleDragOver, { capture: true });
            container.removeEventListener("drop", handleDrop, { capture: true });
        };
    }, [isWindowsPlatform, containerRef, editor, docId]);

    // Block browser default file opening behavior globally (for non-Windows platforms)
    // This is critical to prevent PDF/images from opening in WebView
    useEffect(() => {
        if (isWindowsPlatform) return; // Windows uses the custom handler above

        console.log('[blockFileDrop] Registering global drop prevention listeners');

        const blockFileDrop = (event: DragEvent) => {
            const hasFiles = event.dataTransfer?.types?.includes("Files");
            console.log(`[blockFileDrop] ${event.type} event, hasFiles=${hasFiles}, defaultPrevented=${event.defaultPrevented}`);
            if (hasFiles) {
                event.preventDefault();
                event.stopPropagation();
                console.log(`[blockFileDrop] Prevented default for ${event.type}`);
            }
        };

        window.addEventListener("dragover", blockFileDrop, { capture: true });
        window.addEventListener("drop", blockFileDrop, { capture: true });

        return () => {
            console.log('[blockFileDrop] Removing global drop prevention listeners');
            window.removeEventListener("dragover", blockFileDrop, { capture: true });
            window.removeEventListener("drop", blockFileDrop, { capture: true });
        };
    }, [isWindowsPlatform]);
}
