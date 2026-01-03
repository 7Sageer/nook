import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useCallback, useState } from "react";
import { Folder, Loader2, Check, AlertCircle, RefreshCw, FolderOpen, Eye, Plus } from "lucide-react";
import { IndexFolderContent, SelectFolderDialog, GetExternalBlockContent } from "../../../wailsjs/go/main/App";
import { useDocumentContext } from "../../contexts/DocumentContext";
import { ContentViewerModal } from "../ContentViewerModal";
import "../../styles/FolderBlock.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FolderBlockComponent = (props: { block: any, editor: any }) => {
    const { block, editor } = props;
    const {
        folderPath,
        folderName,
        fileCount,
        indexedCount,
        loading,
        error,
        indexed,
        indexing,
        indexError
    } = block.props;
    const { activeId } = useDocumentContext();

    // 查看内容 Modal 状态
    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    // 选择文件夹
    const handleSelectFolder = useCallback(async () => {
        try {
            const path = await SelectFolderDialog();
            if (!path) return;

            const currentBlock = editor.getBlock(block.id);
            if (!currentBlock) return;

            // 获取文件夹名
            const name = path.split("/").pop() || path;

            editor.updateBlock(currentBlock, {
                props: {
                    ...currentBlock.props,
                    folderPath: path,
                    folderName: name,
                    indexed: false,
                    indexError: "",
                },
            });
        } catch (err) {
            console.error("Failed to select folder:", err);
        }
    }, [block.id, editor]);

    // 索引文件夹内容
    const handleIndex = useCallback(async () => {
        if (!folderPath || !activeId) return;

        const currentBlock = editor.getBlock(block.id);
        if (!currentBlock) return;

        editor.updateBlock(currentBlock, {
            props: { ...currentBlock.props, indexing: true, indexError: "" },
        });

        try {
            const result = await IndexFolderContent(folderPath, activeId, block.id);
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: {
                        ...latestBlock.props,
                        indexed: true,
                        indexing: false,
                        fileCount: result?.totalFiles || 0,
                        indexedCount: result?.successCount || 0,
                    },
                });
            }
        } catch (err) {
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: {
                        ...latestBlock.props,
                        indexing: false,
                        indexError: err instanceof Error ? err.message : "Index failed"
                    },
                });
            }
        }
    }, [block.id, editor, folderPath, activeId]);

    // 查看元数据
    const handleViewContent = useCallback(async () => {
        if (!activeId) return;
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
    }, [activeId, block.id]);

    // 如果没有选择文件夹，显示选择界面
    if (!folderPath) {
        return (
            <div className="folder-block folder-empty" contentEditable={false}>
                <button
                    className="folder-select-btn"
                    onClick={handleSelectFolder}
                >
                    <Plus size={18} />
                    <span>Select a folder to index</span>
                </button>
            </div>
        );
    }

    // 加载状态
    if (loading) {
        return (
            <div className="folder-block folder-loading" contentEditable={false}>
                <Loader2 size={18} className="animate-spin" />
                <span>Loading folder...</span>
            </div>
        );
    }

    // 错误状态
    if (error) {
        return (
            <div className="folder-block folder-error" contentEditable={false}>
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        );
    }

    // 文件夹卡片
    return (
        <div
            className={`folder-block folder-card ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
            contentEditable={false}
        >
            <div className="folder-icon-wrapper">
                <Folder size={24} className="folder-icon" />
            </div>
            <div className="folder-info">
                <div className="folder-name">{folderName}</div>
                <div className="folder-meta">
                    <span className="folder-path">{folderPath}</span>
                    {indexed && (
                        <span className="folder-stats">
                            {indexedCount}/{fileCount} files indexed
                        </span>
                    )}
                </div>
            </div>
            <div className="folder-actions">
                <button
                    className={`folder-action-btn ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
                    title={indexing ? "Indexing..." : indexed ? "Re-index" : indexError ? "Indexing failed, retry?" : "Index folder"}
                    disabled={indexing}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleIndex();
                    }}
                >
                    {indexing ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : indexError ? (
                        <AlertCircle size={14} />
                    ) : indexed ? (
                        <Check size={14} />
                    ) : (
                        <RefreshCw size={14} />
                    )}
                </button>
                {indexed && (
                    <button
                        className="folder-action-btn"
                        title="View indexed info"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewContent();
                        }}
                    >
                        <Eye size={14} />
                    </button>
                )}
                <button
                    className="folder-action-btn"
                    title="Change folder"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectFolder();
                    }}
                >
                    <FolderOpen size={14} />
                </button>
            </div>
            <ContentViewerModal
                isOpen={showContentModal}
                onClose={() => setShowContentModal(false)}
                title={folderName || "Folder Info"}
                content={extractedContent}
                blockType="folder"
                loading={contentLoading}
                error={contentError}
            />
        </div>
    );
};

// FolderBlock 组件
export const FolderBlock = createReactBlockSpec(
    {
        type: "folder",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            folderPath: { default: "" },
            folderName: { default: "" },
            fileCount: { default: 0 },
            indexedCount: { default: 0 },
            loading: { default: false },
            error: { default: "" },
            indexed: { default: false },
            indexing: { default: false },
            indexError: { default: "" },
        },
        content: "none",
    },
    {
        render: FolderBlockComponent,
    }
);
