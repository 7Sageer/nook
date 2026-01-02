import {
    FormattingToolbar,
    TextAlignButton,
    useSelectedBlocks,
    useBlockNoteEditor,
} from "@blocknote/react";
import {
    ExternalLink,
    FolderOpen,
    Eye,
    Pencil,
} from "lucide-react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import {
    OpenFileWithSystem,
    RevealInFinder,
    GetExternalBlockContent,
} from "../../wailsjs/go/main/App";
import { useDocumentContext } from "../contexts/DocumentContext";
import { useState } from "react";
import { ContentViewerModal } from "./ContentViewerModal";

// ========== 自定义工具栏按钮样式 ==========
const toolbarButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: 4,
    color: "inherit",
};

// ========== 通用按钮组件 ==========

// 编辑书签按钮 - 清空 URL 触发编辑模式
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditBookmarkButton({ block }: { block: any }) {
    const editor = useBlockNoteEditor();

    const handleEdit = () => {
        editor.updateBlock(block.id, {
            props: {
                ...block.props,
                url: "",
            },
        });
    };

    return (
        <button
            style={toolbarButtonStyle}
            title="Edit"
            onClick={handleEdit}
        >
            <Pencil size={18} />
        </button>
    );
}

// ========== FileBlock Toolbar ==========
function FileBlockToolbar() {
    const selectedBlocks = useSelectedBlocks();
    const block = selectedBlocks[0];
    const { activeId } = useDocumentContext();

    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    if (!block || block.type !== "file") return null;

    const filePath = block.props?.filePath as string;
    const fileName = block.props?.fileName as string;
    const indexed = block.props?.indexed as boolean;

    const handleOpenFile = () => {
        if (filePath) OpenFileWithSystem(filePath);
    };

    const handleRevealInFinder = () => {
        if (filePath) RevealInFinder(filePath);
    };

    const handleViewContent = async () => {
        if (!activeId || !block.id) return;
        setShowContentModal(true);
        setContentLoading(true);
        setContentError("");
        try {
            const result = await GetExternalBlockContent(activeId, block.id);
            setExtractedContent(result?.content || "");
        } catch (err) {
            setContentError(err instanceof Error ? err.message : "Failed to load content");
        } finally {
            setContentLoading(false);
        }
    };

    return (
        <FormattingToolbar>
            <button
                style={toolbarButtonStyle}
                title="Open File"
                onClick={handleOpenFile}
            >
                <ExternalLink size={18} />
            </button>
            <button
                style={toolbarButtonStyle}
                title="Show in Finder"
                onClick={handleRevealInFinder}
            >
                <FolderOpen size={18} />
            </button>
            {indexed && (
                <button
                    style={toolbarButtonStyle}
                    title="View Content"
                    onClick={handleViewContent}
                >
                    <Eye size={18} />
                </button>
            )}
            <TextAlignButton textAlignment="left" />
            <TextAlignButton textAlignment="center" />
            <TextAlignButton textAlignment="right" />
            <ContentViewerModal
                isOpen={showContentModal}
                onClose={() => setShowContentModal(false)}
                title={fileName || "File Content"}
                content={extractedContent}
                blockType="file"
                loading={contentLoading}
                error={contentError}
            />
        </FormattingToolbar>
    );
}

// ========== BookmarkBlock Toolbar ==========
function BookmarkBlockToolbar() {
    const selectedBlocks = useSelectedBlocks();
    const block = selectedBlocks[0];
    const { activeId } = useDocumentContext();

    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    if (!block || block.type !== "bookmark") return null;

    const url = block.props?.url as string;
    const title = block.props?.title as string;
    const indexed = block.props?.indexed as boolean;

    const handleOpenLink = () => {
        if (url) BrowserOpenURL(url);
    };

    const handleViewContent = async () => {
        if (!activeId || !block.id) return;
        setShowContentModal(true);
        setContentLoading(true);
        setContentError("");
        try {
            const result = await GetExternalBlockContent(activeId, block.id);
            setExtractedContent(result?.content || "");
        } catch (err) {
            setContentError(err instanceof Error ? err.message : "Failed to load content");
        } finally {
            setContentLoading(false);
        }
    };

    return (
        <FormattingToolbar>
            <button
                style={toolbarButtonStyle}
                title="Open Link"
                onClick={handleOpenLink}
            >
                <ExternalLink size={18} />
            </button>
            {indexed && (
                <button
                    style={toolbarButtonStyle}
                    title="View Content"
                    onClick={handleViewContent}
                >
                    <Eye size={18} />
                </button>
            )}
            <EditBookmarkButton block={block} />
            <TextAlignButton textAlignment="left" />
            <TextAlignButton textAlignment="center" />
            <TextAlignButton textAlignment="right" />
            <ContentViewerModal
                isOpen={showContentModal}
                onClose={() => setShowContentModal(false)}
                title={title || "Bookmark Content"}
                content={extractedContent}
                blockType="bookmark"
                url={url}
                loading={contentLoading}
                error={contentError}
            />
        </FormattingToolbar>
    );
}

// ========== 主组件：根据选中块类型返回对应工具栏 ==========
export function CustomFormattingToolbar() {
    const selectedBlocks = useSelectedBlocks();

    if (selectedBlocks.length !== 1) {
        // 多选或无选中时，使用默认工具栏行为
        return <FormattingToolbar />;
    }

    const block = selectedBlocks[0];

    if (block.type === "file") {
        return <FileBlockToolbar />;
    }

    if (block.type === "bookmark") {
        return <BookmarkBlockToolbar />;
    }

    // 其他块类型使用默认工具栏
    return <FormattingToolbar />;
}
