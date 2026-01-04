import {
    FormattingToolbar,
    TextAlignButton,
    useSelectedBlocks,
    useBlockNoteEditor,
    useComponentsContext,
    getFormattingToolbarItems,
} from "@blocknote/react";
import {
    ExternalLink,
    FolderOpen,
    Eye,
    Pencil,
    Trash2,
    Sparkles,
    Replace,
} from "lucide-react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import {
    OpenFileWithSystem,
    RevealInFinder,
    GetExternalBlockContent,
    OpenFileDialog,
    SelectFolderDialog,
} from "../../wailsjs/go/main/App";
import { useDocumentContext } from "../contexts/DocumentContext";
import { useSearchContext } from "../contexts/SearchContext";
import { useState } from "react";
import { ContentViewerModal } from "./ContentViewerModal";

// ========== 通用按钮组件（使用 BlockNote 原生 Button 组件） ==========

// 查找相关文档按钮 - 触发搜索并排除当前文档
function FindRelatedButton() {
    const editor = useBlockNoteEditor();
    const selectedBlocks = useSelectedBlocks();
    const Components = useComponentsContext()!;
    const { setQueryWithExclude } = useSearchContext();

    const handleClick = () => {
        // 获取当前选中的文本或当前块的内容
        const selectedText = editor.getSelectedText?.() || '';

        if (selectedText.trim()) {
            // 如果有选中文本，使用选中的文本触发搜索
            setQueryWithExclude(selectedText.trim());
            return;
        }

        // 对于选中的块，尝试获取内容
        if (selectedBlocks.length > 0) {
            const block = selectedBlocks[0];

            // 特殊处理 bookmark 和 file 区块（它们的 content 是 "none"）
            if (block.type === 'bookmark') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = block.props as any;
                // 使用 title 和 description 组合作为搜索内容
                const searchContent = [props.title, props.description]
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                if (searchContent) {
                    setQueryWithExclude(searchContent);
                    return;
                }
                // 如果没有 title/description，使用 url
                if (props.url) {
                    setQueryWithExclude(props.url);
                    return;
                }
            }

            if (block.type === 'file') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = block.props as any;
                // 使用 fileName 作为搜索内容
                if (props.fileName) {
                    setQueryWithExclude(props.fileName);
                    return;
                }
            }


            if (block.type === 'folder') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = block.props as any;
                // 使用 folderPath (base name) 或 manual name
                const name = props.folderPath || '';
                // Extract base name if path
                const baseName = name.split(/[/\\]/).pop();
                if (baseName) {
                    setQueryWithExclude(baseName);
                    return;
                }
            }

            // 对于普通块，尝试获取 inline content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const content = (block as any).content;
            if (Array.isArray(content)) {
                const text = content
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((c: any) => c.text || '')
                    .join('')
                    .trim();
                if (text) {
                    setQueryWithExclude(text);
                }
            }
        }
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Find Related Documents"
            onClick={handleClick}
            icon={<Sparkles size={18} />}
            label="Find Related"
        />
    );
}

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

// 更换文件按钮
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChangeFileButton({ block }: { block: any }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;

    const handleClick = async () => {
        try {
            const fileInfo = await OpenFileDialog();
            if (!fileInfo || !fileInfo.path) return;

            editor.updateBlock(block.id, {
                props: {
                    ...block.props,
                    filePath: fileInfo.path,
                    fileName: fileInfo.name,
                    fileSize: fileInfo.size,
                    fileType: fileInfo.ext?.replace(".", "") || "",
                    mimeType: fileInfo.mimeType || "",
                    indexed: false,
                    indexError: "",
                },
            });
        } catch (err) {
            console.error("Failed to select file:", err);
        }
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Change File"
            onClick={handleClick}
            icon={<Replace size={18} />}
            label="Change File"
        />
    );
}

// 更换文件夹按钮
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChangeFolderButton({ block }: { block: any }) {
    const editor = useBlockNoteEditor();
    const Components = useComponentsContext()!;

    const handleClick = async () => {
        try {
            const path = await SelectFolderDialog();
            if (!path) return;

            const name = path.split("/").pop() || path;

            editor.updateBlock(block.id, {
                props: {
                    ...block.props,
                    folderPath: path,
                    folderName: name,
                    indexed: false,
                    indexError: "",
                },
            });
        } catch (err) {
            console.error("Failed to select folder:", err);
        }
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Change Folder"
            onClick={handleClick}
            icon={<Replace size={18} />}
            label="Change Folder"
        />
    );
}

// 打开文件夹按钮
function OpenFolderButton({ folderPath }: { folderPath: string }) {
    const Components = useComponentsContext()!;

    const handleClick = () => {
        if (folderPath) OpenFileWithSystem(folderPath);
    };

    return (
        <Components.FormattingToolbar.Button
            mainTooltip="Open Folder"
            onClick={handleClick}
            icon={<ExternalLink size={18} />}
            label="Open Folder"
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
            <ChangeFileButton block={block} />
            <RevealInFinderButton filePath={filePath} />
            {indexed && (
                <ViewContentButton
                    blockId={block.id}
                    activeId={activeId}
                    onViewContent={handleViewContent}
                />
            )}
            <DeleteBlockButton block={block} />
            <FindRelatedButton />
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
            <FindRelatedButton />
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

// ========== FolderBlock Toolbar ==========
function FolderBlockToolbar() {
    const selectedBlocks = useSelectedBlocks();
    const block = selectedBlocks[0];

    if (!block || block.type !== "folder") return null;

    const folderPath = block.props?.folderPath as string;

    return (
        <FormattingToolbar>
            <OpenFolderButton folderPath={folderPath} />
            <ChangeFolderButton block={block} />
            <RevealInFinderButton filePath={folderPath} />
            <DeleteBlockButton block={block} />
            <FindRelatedButton />
            <TextAlignButton textAlignment="left" />
            <TextAlignButton textAlignment="center" />
            <TextAlignButton textAlignment="right" />
        </FormattingToolbar>
    );
}

// ========== 主组件：根据选中块类型返回对应工具栏 ==========
export function CustomFormattingToolbar() {
    const selectedBlocks = useSelectedBlocks();

    // 单块选中时，检查特殊块类型
    if (selectedBlocks.length === 1) {
        const block = selectedBlocks[0];

        if (block.type === "file") {
            return <FileBlockToolbar />;
        }

        if (block.type === "bookmark") {
            return <BookmarkBlockToolbar />;
        }

        if (block.type === "folder") {
            return <FolderBlockToolbar />;
        }
    }

    // 所有其他情况（包括多选、拖动选择等）：默认工具栏 + 查找相关按钮
    return (
        <FormattingToolbar>
            {...getFormattingToolbarItems()}
            <FindRelatedButton />
        </FormattingToolbar>
    );
}
