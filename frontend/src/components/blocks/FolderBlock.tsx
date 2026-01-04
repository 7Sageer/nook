import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useCallback } from "react";
import { Folder, Loader2, Check, AlertCircle, RefreshCw, Replace, Plus, ExternalLink, Eye } from "lucide-react";
import { IndexFolderContent, SelectFolderDialog, RevealInFinder, OpenFileWithSystem } from "../../../wailsjs/go/main/App";
import { useDocumentContext } from "../../contexts/DocumentContext";
import "../../styles/ExternalBlock.css";
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

    // 在 Finder 中打开
    const handleRevealInFinder = useCallback(() => {
        if (folderPath) {
            RevealInFinder(folderPath);
        }
    }, [folderPath]);

    // 打开文件夹
    const handleOpenFolder = useCallback(() => {
        if (folderPath) {
            OpenFileWithSystem(folderPath);
        }
    }, [folderPath]);

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
            <div className="external-block external-loading" contentEditable={false}>
                <Loader2 size={18} className="animate-spin" />
                <span>Loading folder...</span>
            </div>
        );
    }

    // 错误状态
    if (error) {
        return (
            <div className="external-block external-error" contentEditable={false}>
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        );
    }

    // 文件夹卡片
    return (
        <div
            className={`external-block external-card ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""} folder-card-custom`}
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
            <div className="external-actions">
                <button
                    className={`external-action-btn ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
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
                <button
                    className="external-action-btn"
                    title="Change folder"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectFolder();
                    }}
                >
                    <Replace size={14} />
                </button>
                <button
                    className="external-action-btn"
                    title="Open folder"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenFolder();
                    }}
                >
                    <ExternalLink size={14} />
                </button>
                <button
                    className="external-action-btn"
                    title="Reveal in Finder"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRevealInFinder();
                    }}
                >
                    <Eye size={14} />
                </button>
            </div>
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
