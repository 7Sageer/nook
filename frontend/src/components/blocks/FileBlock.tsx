import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useCallback } from "react";
import { FileText, File, Loader2, Check, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { OpenFileWithSystem, IndexFileContent } from "../../../wailsjs/go/main/App";
import { useDocumentContext } from "../../contexts/DocumentContext";
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
    const handleOpenFile = useCallback(() => {
        if (filePath) {
            OpenFileWithSystem(filePath);
        }
    }, [filePath]);

    // 加载状态
    if (loading) {
        return (
            <div className="file-block file-loading" contentEditable={false}>
                <Loader2 size={18} className="animate-spin" />
                <span>Uploading file...</span>
            </div>
        );
    }

    // 错误状态
    if (error) {
        return (
            <div className="file-block file-error" contentEditable={false}>
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        );
    }

    // 文件卡片
    return (
        <div
            className={`file-block file-card ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
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
            <div className="file-actions">
                <button
                    className={`file-action-btn ${indexed ? "indexed" : ""} ${indexError ? "index-error" : ""}`}
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
                    ) : indexed ? (
                        <Check size={14} />
                    ) : indexError ? (
                        <AlertCircle size={14} />
                    ) : (
                        <RefreshCw size={14} />
                    )}
                </button>
                <button
                    className="file-action-btn"
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
