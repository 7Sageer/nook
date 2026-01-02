import { SideMenuExtension } from "@blocknote/core/extensions";
import {
    useBlockNoteEditor,
    useComponentsContext,
    useExtensionState,
    DragHandleMenu,
    RemoveBlockItem,
    BlockColorsItem,
} from "@blocknote/react";
import {
    Trash2,
    ExternalLink,
    FolderOpen,
    Replace,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Pencil,
} from "lucide-react";
import { ReactNode } from "react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import {
    OpenFileWithSystem,
    RevealInFinder,
    OpenFileDialog,
} from "../../wailsjs/go/main/App";

// ========== 通用菜单项组件 ==========

// 删除块
export function DeleteBlockItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block) return null;

    return (
        <Components.Generic.Menu.Item
            onClick={() => editor.removeBlocks([block])}
        >
            <Trash2 size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// ========== FileBlock 专用菜单项 ==========

// 打开文件
function OpenFileItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block || block.type !== "file") return null;
    const filePath = block.props?.filePath;
    if (!filePath) return null;

    return (
        <Components.Generic.Menu.Item
            onClick={() => OpenFileWithSystem(filePath)}
        >
            <ExternalLink size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// 在 Finder 中显示
function RevealInFinderItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block || block.type !== "file") return null;
    const filePath = block.props?.filePath;
    if (!filePath) return null;

    return (
        <Components.Generic.Menu.Item
            onClick={() => RevealInFinder(filePath)}
        >
            <FolderOpen size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// 替换文件
function ReplaceFileItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block || block.type !== "file") return null;

    const handleReplace = async () => {
        try {
            const fileInfo = await OpenFileDialog();
            if (!fileInfo || !fileInfo.filePath) return;

            editor.updateBlock(block, {
                props: {
                    filePath: fileInfo.filePath,
                    fileName: fileInfo.fileName,
                    fileSize: fileInfo.fileSize,
                    fileType: fileInfo.fileType,
                    mimeType: fileInfo.mimeType,
                    indexed: false,
                    indexing: false,
                    indexError: "",
                },
            });
        } catch (err) {
            console.error("Failed to replace file:", err);
        }
    };

    return (
        <Components.Generic.Menu.Item onClick={handleReplace}>
            <Replace size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// ========== BookmarkBlock 专用菜单项 ==========

// 打开链接
function OpenLinkItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block || block.type !== "bookmark") return null;
    const url = block.props?.url;
    if (!url) return null;

    return (
        <Components.Generic.Menu.Item
            onClick={() => BrowserOpenURL(url)}
        >
            <ExternalLink size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// 编辑书签 - 清空 URL 以触发编辑模式
function EditBookmarkItem({ children }: { children: ReactNode }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block || block.type !== "bookmark") return null;

    const handleEdit = () => {
        // 清空 URL 来触发编辑模式，同时保留原始 URL 在 inputValue 中
        editor.updateBlock(block, {
            props: {
                ...block.props,
                url: "",
            },
        });
    };

    return (
        <Components.Generic.Menu.Item onClick={handleEdit}>
            <Pencil size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// ========== 对齐菜单项 ==========

function AlignmentItem({
    alignment,
    children,
}: {
    alignment: "left" | "center" | "right";
    children: ReactNode;
}) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    if (!block) return null;

    const Icon = alignment === "left" ? AlignLeft : alignment === "center" ? AlignCenter : AlignRight;

    return (
        <Components.Generic.Menu.Item
            onClick={() => {
                editor.updateBlock(block, {
                    props: { ...block.props, textAlignment: alignment },
                });
            }}
        >
            <Icon size={16} style={{ marginRight: 8 }} />
            {children}
        </Components.Generic.Menu.Item>
    );
}

// ========== 自定义 DragHandleMenu ==========

export function CustomDragHandleMenu() {
    const editor = useBlockNoteEditor();
    const block = useExtensionState(SideMenuExtension, {
        editor,
        selector: (state) => state?.block,
    });

    // 根据 block 类型显示不同菜单
    if (block?.type === "file") {
        return (
            <DragHandleMenu>
                <OpenFileItem>Open File</OpenFileItem>
                <RevealInFinderItem>Show in Finder</RevealInFinderItem>
                <ReplaceFileItem>Replace File</ReplaceFileItem>
                <AlignmentItem alignment="left">Align Left</AlignmentItem>
                <AlignmentItem alignment="center">Align Center</AlignmentItem>
                <AlignmentItem alignment="right">Align Right</AlignmentItem>
                <DeleteBlockItem>Delete</DeleteBlockItem>
            </DragHandleMenu>
        );
    }

    if (block?.type === "bookmark") {
        return (
            <DragHandleMenu>
                <OpenLinkItem>Open Link</OpenLinkItem>
                <EditBookmarkItem>Edit</EditBookmarkItem>
                <AlignmentItem alignment="left">Align Left</AlignmentItem>
                <AlignmentItem alignment="center">Align Center</AlignmentItem>
                <AlignmentItem alignment="right">Align Right</AlignmentItem>
                <DeleteBlockItem>Delete</DeleteBlockItem>
            </DragHandleMenu>
        );
    }

    // 默认菜单（其他块类型）
    return (
        <DragHandleMenu>
            <RemoveBlockItem>Delete</RemoveBlockItem>
            <BlockColorsItem>Colors</BlockColorsItem>
        </DragHandleMenu>
    );
}
