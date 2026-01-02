import {
    FormattingToolbar,
    TextAlignButton,
    useSelectedBlocks,
    useBlockNoteEditor,
    useComponentsContext,
} from "@blocknote/react";
import {
    ExternalLink,
    FolderOpen,
    Eye,
    Pencil,
    Trash2,
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

// ========== 通用按钮组件（使用 BlockNote 原生 Button 组件） ==========

// 编辑书签按钮 - 清空 URL 触发编辑模式
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditBookmarkButton({ block }: { block: any }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;

    const handleEdit = () => {
        editor.updateBlock(block.id, {
            props: {
                ...block.props,
                url: "",
            },
        });
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Edit"
            onClick={handleEdit}
            icon={<Pencil size={18} />}
            label="Edit"
        />
    );
}

// 删除块按钮
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeleteBlockButton({ block }: { block: any }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;

    const handleDelete = () => {
        editor.removeBlocks([block.id]);
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Delete"
            onClick={handleDelete}
            icon={<Trash2 size={18} />}
            label="Delete"
        />
    );
}

// 打开文件按钮
function OpenFileButton({ filePath }: { filePath: string }) {
    const Components = useComponentsContext()!;

    const handleClick = () => {
        if (filePath) OpenFileWithSystem(filePath);
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Open File"
            onClick={handleClick}
            icon={<ExternalLink size={18} />}
            label="Open File"
        />
    );
}

// 在 Finder 中显示按钮
function RevealInFinderButton({ filePath }: { filePath: string }) {
    const Components = useComponentsContext()!;

    const handleClick = () => {
        if (filePath) RevealInFinder(filePath);
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Show in Finder"
            onClick={handleClick}
            icon={<FolderOpen size={18} />}
            label="Show in Finder"
        />
    );
}

// 打开链接按钮
function OpenLinkButton({ url }: { url: string }) {
    const Components = useComponentsContext()!;

    const handleClick = () => {
        if (url) BrowserOpenURL(url);
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Open Link"
            onClick={handleClick}
            icon={<ExternalLink size={18} />}
            label="Open Link"
        />
    );
}

// 查看内容按钮
function ViewContentButton({
    blockId,
    activeId,
    onViewContent,
}: {
    blockId: string;
    activeId: string | null;
    onViewContent: () => void;
}) {
    const Components = useComponentsContext()!;

    const handleClick = () => {
        if (activeId && blockId) {
            onViewContent();
        }
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="View Content"
            onClick={handleClick}
            icon={<Eye size={18} />}
            label="View Content"
        />
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
            <OpenFileButton filePath={filePath} />
            <RevealInFinderButton filePath={filePath} />
            {indexed && (
                <ViewContentButton
                    blockId={block.id}
                    activeId={activeId}
                    onViewContent={handleViewContent}
                />
            )}
            <DeleteBlockButton block={block} />
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
            <OpenLinkButton url={url} />
            {indexed && (
                <ViewContentButton
                    blockId={block.id}
                    activeId={activeId}
                    onViewContent={handleViewContent}
                />
            )}
            <EditBookmarkButton block={block} />
            <DeleteBlockButton block={block} />
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
