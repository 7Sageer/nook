/**
 * Editor Extensions and Plugins
 *
 * This file contains custom TipTap extensions, ProseMirror plugins,
 * and helper functions for the BlockNote editor.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { createExtension } from "@blocknote/core";
import { getStrings } from "../constants/strings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalEditor = any;
type StringsType = ReturnType<typeof getStrings>;

/**
 * Module-level state to track Chinese IME composition.
 * Used to prevent slash menu from triggering during IME input.
 */
let isComposing = false;

const chineseIMEPluginKey = new PluginKey("chineseIMEFix");

/**
 * Check if Chinese IME is currently composing.
 * Exported for use in other components (e.g., ChatContainer).
 */
export function getIsComposing(): boolean {
    return isComposing;
}

/**
 * ProseMirror plugin to fix Chinese IME breaking slash menu.
 * Tracks composition state and closes the suggestion menu if triggered during composition.
 */
export function createChineseIMEPlugin(editor: InternalEditor) {
    return new Plugin({
        key: chineseIMEPluginKey,
        props: {
            handleDOMEvents: {
                compositionstart: () => {
                    isComposing = true;
                    return false;
                },
                compositionend: () => {
                    // Use setTimeout to ensure compositionend fires after the last input event
                    setTimeout(() => {
                        isComposing = false;
                    }, 0);
                    return false;
                },
            },
        },
        view: () => ({
            update: () => {
                // If we're composing and the suggestion menu is shown, close it
                if (isComposing) {
                    try {
                        // Access BlockNote's internal suggestion menu state
                        const suggestionMenuExt = editor._extensions?.suggestionMenu;
                        if (suggestionMenuExt?.shown?.()) {
                            suggestionMenuExt.closeMenu?.();
                        }
                    } catch {
                        // Silently ignore if we can't access the menu
                    }
                }
            },
            destroy: () => { },
        }),
    });
}

/**
 * TipTap extension to make bookmark node atomic (prevents selecting internal content).
 * When a node is atomic, clicking on it selects the whole node instead of placing
 * the cursor inside it.
 */
const BookmarkAtomTiptapExtension = Extension.create({
    name: "bookmarkAtom",
    extendNodeSchema(extension) {
        // Only set atom: true for the bookmark node type
        if (extension.name === "bookmark") {
            return { atom: true };
        }
        return {};
    },
});

/**
 * BlockNote extension wrapper for the TipTap bookmark atom extension.
 */
export const bookmarkAtomExtension = createExtension({
    key: "bookmarkAtom",
    tiptapExtensions: [BookmarkAtomTiptapExtension],
});

/**
 * Moves selection to the next content-editable block.
 * Mirrors BlockNote's default slash-menu behavior.
 */
export function setSelectionToNextContentEditableBlock(editor: InternalEditor) {
    let block = editor.getTextCursorPosition().block;
    let contentType = editor.schema.blockSchema[block.type].content;

    while (contentType === "none") {
        block = editor.getTextCursorPosition().nextBlock;
        if (!block) return;
        contentType = editor.schema.blockSchema[block.type].content;
        editor.setTextCursorPosition(block, "end");
    }
}

/**
 * Insert or update a bookmark block from the slash menu.
 * If the current block is empty (or only contains "/"), updates it in-place.
 * Otherwise, inserts a new bookmark block below.
 */
export function insertOrUpdateBookmarkForSlashMenu(editor: InternalEditor) {
    const currentBlock = editor.getTextCursorPosition().block;
    const currentContent = currentBlock.content;

    const isEmptyOrSlash =
        Array.isArray(currentContent) &&
        (currentContent.length === 0 ||
            (currentContent.length === 1 &&
                currentContent[0]?.type === "text" &&
                currentContent[0]?.text === "/"));

    const newBlock = isEmptyOrSlash
        ? editor.updateBlock(currentBlock, { type: "bookmark" as const })
        : editor.insertBlocks([{ type: "bookmark" as const }], currentBlock, "after")[0];

    editor.setTextCursorPosition(newBlock);
    setSelectionToNextContentEditableBlock(editor);

    return newBlock;
}

/**
 * Insert a bookmark block with a pre-filled URL.
 * Used when pasting a URL and choosing to create a bookmark.
 */
export function insertBookmarkWithUrl(editor: InternalEditor, url: string) {
    const currentBlock = editor.getTextCursorPosition().block;
    const currentContent = currentBlock.content;

    // 检查当前块是否为空
    const isEmpty =
        Array.isArray(currentContent) && currentContent.length === 0;

    const bookmarkProps = {
        url,
        title: "",
        description: "",
        image: "",
        favicon: "",
        siteName: "",
        loading: true,
        error: "",
        indexed: false,
        indexing: false,
        indexError: "",
    };

    const newBlock = isEmpty
        ? editor.updateBlock(currentBlock, {
            type: "bookmark" as const,
            props: bookmarkProps,
        })
        : editor.insertBlocks(
            [{ type: "bookmark" as const, props: bookmarkProps }],
            currentBlock,
            "after"
        )[0];

    editor.setTextCursorPosition(newBlock);
    setSelectionToNextContentEditableBlock(editor);

    return newBlock;
}

/**
 * Create a custom slash menu item for inserting bookmarks.
 */
export function createBookmarkMenuItem(editor: InternalEditor, strings: StringsType) {
    return {
        title: strings.LABELS.BOOKMARK,
        onItemClick: () => {
            insertOrUpdateBookmarkForSlashMenu(editor);
        },
        aliases: ["bookmark", "link", "embed", "url"],
        group: "Media",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
        ),
        subtext: strings.TOOLTIPS.OPEN_FILE,
    };
}

// ========== FileBlock 相关函数 ==========

/**
 * FileInfo 类型定义（与后端 handlers.FileInfo 对应）
 */
export interface FileInfo {
    filePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    mimeType: string;
}

/**
 * 插入 FileBlock
 */
export function insertFileBlock(editor: InternalEditor, fileInfo: FileInfo) {
    const currentBlock = editor.getTextCursorPosition().block;
    const currentContent = currentBlock.content;

    const isEmptyOrSlash =
        Array.isArray(currentContent) &&
        (currentContent.length === 0 ||
            (currentContent.length === 1 &&
                currentContent[0]?.type === "text" &&
                currentContent[0]?.text === "/"));

    const fileProps = {
        filePath: fileInfo.filePath,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileType: fileInfo.fileType,
        mimeType: fileInfo.mimeType,
        loading: false,
        error: "",
        indexed: false,
        indexing: false,
        indexError: "",
    };

    const newBlock = isEmptyOrSlash
        ? editor.updateBlock(currentBlock, {
            type: "file" as const,
            props: fileProps,
        })
        : editor.insertBlocks(
            [{ type: "file" as const, props: fileProps }],
            currentBlock,
            "after"
        )[0];

    editor.setTextCursorPosition(newBlock);
    setSelectionToNextContentEditableBlock(editor);

    return newBlock;
}

/**
 * 创建 File slash menu 项
 */
export function createFileMenuItem(
    editor: InternalEditor,
    strings: StringsType,
    onSelectFile: () => Promise<FileInfo | null>
) {
    return {
        title: strings.LABELS.FILE || "File",
        onItemClick: async () => {
            const fileInfo = await onSelectFile();
            if (fileInfo) {
                insertFileBlock(editor, fileInfo);
            }
        },
        aliases: ["file", "document", "attachment", "pdf", "txt", "md"],
        group: "Media",
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
        ),
        subtext: strings.LABELS.FILE_SUBTEXT || "Embed MD, TXT file",
    };
}

/**
 * 文件转 base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
