import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useCallback, useState } from "react";
import { FileText, File, Loader2, Check, AlertCircle, RefreshCw, ExternalLink, Eye, Replace } from "lucide-react";
import { OpenFileWithSystem, IndexFileContent, GetExternalBlockContent, OpenFileDialog } from "../../../wailsjs/go/main/App";
import { useDocumentContext } from "../../contexts/DocumentContext";
import { ContentViewerModal } from "../ContentViewerModal";
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
    const { filePath, fileName, fileSize, fileType, loading, error, indexed, indexing, indexError } = block.props;
    const { activeId } = useDocumentContext();

    // 查看内容 Modal 状态
    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    // 选择新文件替换
    const handleSelectFile = useCallback(async () => {
        try {
            const fileInfo = await OpenFileDialog();
            if (!fileInfo || !fileInfo.filePath) return;

            const currentBlock = editor.getBlock(block.id);
            if (!currentBlock) return;

            editor.updateBlock(currentBlock, {
                props: {
                    ...currentBlock.props,
                    filePath: fileInfo.filePath,
                    fileName: fileInfo.fileName,
                    fileSize: fileInfo.fileSize,
                    fileType: fileInfo.fileType?.replace(".", "") || "",
                    mimeType: fileInfo.mimeType || "",
                    indexed: false,
                    indexError: "",
                },
            });
        } catch (err) {
            console.error("Failed to select file:", err);
        }
    }, [block.id, editor]);

    // 索引文件内容
    const handleIndex = useCallback(async () => {
        if (!filePath || !activeId) return;

        const currentBlock = editor.getBlock(block.id);
        if (!currentBlock) return;

        editor.updateBlock(currentBlock, {
            props: { ...currentBlock.props, indexing: true, indexError: "" },
        });

        try {
            await IndexFileContent(filePath, activeId, block.id);
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexed: true, indexing: false },
                });
            }
        } catch {
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexing: false, indexError: "Index failed" },
                });
            }
        }
    }, [block.id, editor, filePath, activeId]);

    // 打开文件
    const handleOpenFile = useCallback(async () => {
        console.log("[FileBlock] handleOpenFile called, filePath:", filePath);
        if (filePath) {
            try {
                await OpenFileWithSystem(filePath);
                console.log("[FileBlock] OpenFileWithSystem completed successfully");
            } catch (err) {
                console.error("[FileBlock] OpenFileWithSystem failed:", err);
            }
        } else {
            console.warn("[FileBlock] No filePath available");
        }
    }, [filePath]);

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

    // 文件卡片
    return (
        <div
            className={`external-block external-card ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""} file-card-custom`}
            contentEditable={false}
            onDoubleClick={handleOpenFile}
        >
            <div className="file-icon-wrapper">
                <FileTypeIcon type={fileType} />
            </div>
            <div className="file-info">
                <div className="file-name">{fileName}</div>
                <div className="file-meta">
                    <span className="file-type">{fileType.toUpperCase()}</span>
                    <span className="file-size">{formatFileSize(fileSize)}</span>
                </div>
            </div>
            <div className="external-actions">
                <button
                    className={`external-action-btn ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
                    title={indexing ? "Indexing..." : indexed ? "Re-index" : indexError ? "Indexing failed, retry?" : "Index content"}
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
            filePath: { default: "" },
            fileName: { default: "" },
            fileSize: { default: 0 },
            fileType: { default: "" },
            mimeType: { default: "" },
            loading: { default: false },
            error: { default: "" },
            indexed: { default: false },
            indexing: { default: false },
            indexError: { default: "" },
        },
        content: "none",
    },
    {
        render: FileBlockComponent,
    }
);
