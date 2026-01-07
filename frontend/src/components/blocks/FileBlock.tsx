import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useCallback, useState, useEffect } from "react";
import { FileText, File, Loader2, Check, AlertCircle, RefreshCw, ExternalLink, Eye, Replace, Archive, ArchiveRestore, RefreshCcw, Link, AlertTriangle, FolderOpen } from "lucide-react";
import { OpenFileWithSystem, IndexFileContent, GetExternalBlockContent, OpenFileDialog, ArchiveFile, UnarchiveFile, SyncArchivedFile, CheckFileExists, RevealInFinder, GetEffectiveFilePath } from "../../../wailsjs/go/main/App";
import { useDocumentContext } from "../../contexts/DocumentContext";
import { ContentViewerModal } from "../modals/ContentViewerModal";
import "../../styles/ExternalBlock.css";
import "../../styles/FileBlock.css";

// 文件类型图标
const FileTypeIcon = ({ type }: { type: string }) => {
    const iconClass = `file-icon ${type}`;
    switch (type) {
        case "pdf":
        case "docx":
        case "md":
            return <FileText size={24} className={iconClass} />;
        default:
            return <File size={24} className={iconClass} />;
    }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FileBlockComponent = (props: { block: any, editor: any }) => {
    const { block, editor } = props;
    const {
        originalPath,
        fileName,
        fileSize,
        fileType,
        loading,
        error,
        archived,
        archivedPath,
        archivedAt,
        fileMissing,
        indexed,
        indexing,
        indexError,
        // 兼容旧数据
        filePath: legacyFilePath,
    } = block.props;
    const { activeId } = useDocumentContext();

    // 查看内容 Modal 状态
    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");
    // 归档操作状态
    const [archiving, setArchiving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    // Windows 平台检测（Windows 上文件拖拽已自动归档，无需手动归档/取消归档按钮）
    const isWindows = navigator.userAgent.includes("Windows");

    // 获取有效路径（兼容旧数据）
    const effectivePath = originalPath || legacyFilePath;
    const isLegacyData = !originalPath && legacyFilePath;

    // 检查文件是否存在
    useEffect(() => {
        if (!effectivePath || isLegacyData) return;

        const checkFile = async () => {
            const exists = await CheckFileExists(effectivePath);
            const currentBlock = editor.getBlock(block.id);
            if (currentBlock && currentBlock.props.fileMissing !== !exists) {
                editor.updateBlock(currentBlock, {
                    props: { ...currentBlock.props, fileMissing: !exists },
                });
            }
        };
        checkFile();
    }, [effectivePath, isLegacyData, block.id, editor]);

    // 选择新文件替换
    const handleSelectFile = useCallback(async () => {
        try {
            const fileInfo = await OpenFileDialog();
            if (!fileInfo || !fileInfo.originalPath) return;

            const currentBlock = editor.getBlock(block.id);
            if (!currentBlock) return;

            editor.updateBlock(currentBlock, {
                props: {
                    ...currentBlock.props,
                    originalPath: fileInfo.originalPath,
                    fileName: fileInfo.fileName,
                    fileSize: fileInfo.fileSize,
                    fileType: fileInfo.fileType?.replace(".", "") || "",
                    mimeType: fileInfo.mimeType || "",
                    archived: false,
                    archivedPath: "",
                    archivedAt: 0,
                    fileMissing: false,
                    indexed: false,
                    indexError: "",
                    // 清除旧数据
                    filePath: "",
                },
            });
        } catch (err) {
            console.error("Failed to select file:", err);
        }
    }, [block.id, editor]);

    // 索引文件内容（优先使用归档副本）
    const handleIndex = useCallback(async () => {
        if (!activeId) return;

        // 获取有效路径
        let pathToIndex = effectivePath;
        if (archived && archivedPath) {
            pathToIndex = archivedPath;
        }
        if (!pathToIndex) return;

        const currentBlock = editor.getBlock(block.id);
        if (!currentBlock) return;

        editor.updateBlock(currentBlock, {
            props: { ...currentBlock.props, indexing: true, indexError: "" },
        });

        try {
            await IndexFileContent(pathToIndex, activeId, block.id, fileName || "");
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexed: true, indexing: false },
                });
            }
        } catch (err) {
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                // Wails 返回的错误是字符串类型
                const errorMsg = typeof err === "string" ? err : (err instanceof Error ? err.message : "Index failed");
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexing: false, indexError: errorMsg },
                });
            }
        }
    }, [block.id, editor, effectivePath, archived, archivedPath, activeId, fileName]);

    // 打开文件（优先使用归档副本）
    const handleOpenFile = useCallback(async () => {
        // 获取有效路径
        let pathToOpen = effectivePath;
        if (archived && archivedPath) {
            pathToOpen = archivedPath;
        }
        if (!pathToOpen) {
            console.warn("[FileBlock] No path available");
            return;
        }

        console.log("[FileBlock] handleOpenFile called, path:", pathToOpen);
        try {
            await OpenFileWithSystem(pathToOpen);
            console.log("[FileBlock] OpenFileWithSystem completed successfully");
        } catch (err) {
            console.error("[FileBlock] OpenFileWithSystem failed:", err);
        }
    }, [effectivePath, archived, archivedPath]);

    // 在 Finder 中显示
    const handleRevealInFinder = useCallback(async () => {
        if (effectivePath) {
            await RevealInFinder(effectivePath);
        }
    }, [effectivePath]);

    // 查看提取的内容
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

    // 归档文件
    const handleArchive = useCallback(async () => {
        if (!effectivePath) return;
        setArchiving(true);

        try {
            const result = await ArchiveFile(effectivePath);
            if (result) {
                const currentBlock = editor.getBlock(block.id);
                if (currentBlock) {
                    editor.updateBlock(currentBlock, {
                        props: {
                            ...currentBlock.props,
                            archived: true,
                            archivedPath: result.archivedPath,
                            archivedAt: result.archivedAt,
                        },
                    });
                }
            }
        } catch (err) {
            console.error("Failed to archive file:", err);
        } finally {
            setArchiving(false);
        }
    }, [effectivePath, block.id, editor]);

    // 取消归档
    const handleUnarchive = useCallback(async () => {
        if (!archivedPath) return;
        setArchiving(true);

        try {
            await UnarchiveFile(archivedPath);
            const currentBlock = editor.getBlock(block.id);
            if (currentBlock) {
                editor.updateBlock(currentBlock, {
                    props: {
                        ...currentBlock.props,
                        archived: false,
                        archivedPath: "",
                        archivedAt: 0,
                    },
                });
            }
        } catch (err) {
            console.error("Failed to unarchive file:", err);
        } finally {
            setArchiving(false);
        }
    }, [archivedPath, block.id, editor]);

    // 同步归档文件
    const handleSync = useCallback(async () => {
        if (!effectivePath || !archivedPath) return;
        setSyncing(true);

        try {
            const result = await SyncArchivedFile(effectivePath, archivedPath);
            if (result) {
                const currentBlock = editor.getBlock(block.id);
                if (currentBlock) {
                    editor.updateBlock(currentBlock, {
                        props: {
                            ...currentBlock.props,
                            archivedAt: result.archivedAt,
                        },
                    });
                }
            }
        } catch (err) {
            console.error("Failed to sync archived file:", err);
        } finally {
            setSyncing(false);
        }
    }, [effectivePath, archivedPath, block.id, editor]);

    // 加载状态
    if (loading) {
        return (
            <div className="external-block external-loading" contentEditable={false}>
                <Loader2 size={18} className="animate-spin" />
                <span>Uploading file...</span>
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

    // 文件丢失状态（未归档时）
    if (fileMissing && !archived) {
        return (
            <div className="external-block external-error file-missing" contentEditable={false}>
                <AlertTriangle size={18} />
                <div className="file-missing-info">
                    <span className="file-missing-name">{fileName}</span>
                    <span className="file-missing-path">{effectivePath}</span>
                </div>
                <div className="external-actions">
                    <button
                        className="external-action-btn"
                        title="Relocate file"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectFile();
                        }}
                    >
                        <Replace size={14} />
                    </button>
                </div>
            </div>
        );
    }

    // 文件卡片
    return (
        <div
            className={`external-block external-card ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""} ${archived ? "archived" : ""} file-card-custom`}
            contentEditable={false}
            onDoubleClick={handleOpenFile}
        >
            <div className="file-icon-wrapper">
                <FileTypeIcon type={fileType} />
                {archived && <Archive size={12} className="archive-badge" />}
                {!archived && <Link size={12} className="link-badge" />}
            </div>
            <div className="file-info">
                <div className="file-name">{fileName}</div>
                <div className="file-meta">
                    <span className="file-type">{fileType?.toUpperCase()}</span>
                    <span className="file-size">{formatFileSize(fileSize)}</span>
                    {archived && <span className="file-archived-badge">Archived</span>}
                </div>
                <div className="file-path" title={effectivePath}>{effectivePath}</div>
            </div>
            <div className="external-actions">
                {/* 索引按钮 */}
                <button
                    className={`external-action-btn ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
                    title={indexing ? "Indexing..." : indexed ? "Re-index" : indexError ? `Index failed: ${indexError}` : "Index content"}
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
                {/* 查看内容按钮 */}
                {indexed && (
                    <button
                        className="external-action-btn"
                        title="View extracted content"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewContent();
                        }}
                    >
                        <Eye size={14} />
                    </button>
                )}
                {/* 归档/取消归档按钮 - Windows 上隐藏（文件拖拽已自动归档） */}
                {!isWindows && (
                    !archived ? (
                        <button
                            className="external-action-btn"
                            title={archiving ? "Archiving..." : "Archive file"}
                            disabled={archiving || fileMissing}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleArchive();
                            }}
                        >
                            {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                        </button>
                    ) : (
                        <>
                            <button
                                className="external-action-btn"
                                title={syncing ? "Syncing..." : "Sync from original"}
                                disabled={syncing || fileMissing}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSync();
                                }}
                            >
                                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            </button>
                            <button
                                className="external-action-btn"
                                title={archiving ? "Removing..." : "Remove archive"}
                                disabled={archiving}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUnarchive();
                                }}
                            >
                                {archiving ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
                            </button>
                        </>
                    )
                )}
                {/* 替换文件按钮 */}
                <button
                    className="external-action-btn"
                    title="Change file"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectFile();
                    }}
                >
                    <Replace size={14} />
                </button>
                {/* 打开文件按钮 */}
                <button
                    className="external-action-btn"
                    title="Open file"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenFile();
                    }}
                >
                    <ExternalLink size={14} />
                </button>
                {/* 在 Finder 中显示 */}
                <button
                    className="external-action-btn"
                    title="Reveal in Finder"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRevealInFinder();
                    }}
                >
                    <FolderOpen size={14} />
                </button>
            </div>
            <ContentViewerModal
                isOpen={showContentModal}
                onClose={() => setShowContentModal(false)}
                title={fileName || "File Content"}
                content={extractedContent}
                blockType="file"
                loading={contentLoading}
                error={contentError}
            />
        </div>
    );
};

// FileBlock 组件
export const FileBlock = createReactBlockSpec(
    {
        type: "file",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            // 引用信息（始终保留）
            originalPath: { default: "" },   // 原始绝对路径
            fileName: { default: "" },
            fileSize: { default: 0 },
            fileType: { default: "" },
            mimeType: { default: "" },
            // 归档信息
            archived: { default: false },    // 是否已归档
            archivedPath: { default: "" },   // 归档后的本地路径 /files/xxx
            archivedAt: { default: 0 },      // 归档时间戳
            // 状态
            loading: { default: false },
            error: { default: "" },
            fileMissing: { default: false }, // 原文件是否丢失
            // 索引信息
            indexed: { default: false },
            indexing: { default: false },
            indexError: { default: "" },
            // 兼容旧数据（deprecated，迁移后可删除）
            filePath: { default: "" },
        },
        content: "none",
    },
    {
        render: FileBlockComponent,
    }
);
