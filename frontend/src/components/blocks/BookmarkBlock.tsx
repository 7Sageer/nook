import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pencil, ExternalLink, RefreshCw, Check, Loader2, AlertCircle, Eye } from "lucide-react";
import { FetchLinkMetadata, IndexBookmarkContent, GetExternalBlockContent } from "../../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { useDocumentContext } from "../../contexts/DocumentContext";
import { ContentViewerModal } from "../ContentViewerModal";
import "../../styles/BookmarkBlock.css";

// 模块级别的状态管理：追踪正在 fetch 的 bookmark IDs
// 使用 Set 而不是污染 window 对象
const fetchingBookmarks = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BookmarkBlockComponent = (props: { block: any, editor: any }) => {
    const { block, editor } = props;
    const { url, title, description, image, favicon, siteName, loading, error, indexed, indexing, indexError } = block.props;
    const { activeId } = useDocumentContext();

    const [inputValue, setInputValue] = useState(url || "");
    const [isEditing, setIsEditing] = useState(!url);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // 查看内容 Modal 状态
    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    useEffect(() => {
        if (!isEditing) return;
        // Hide virtual caret when input is active
        const caretEl = document.querySelector('[data-smooth-caret]') as HTMLElement;
        if (caretEl) {
            caretEl.style.display = 'none';
        }

        const raf = requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
        return () => {
            cancelAnimationFrame(raf);
            // Restore virtual caret when done editing
            if (caretEl) {
                caretEl.style.display = '';
            }
        };
    }, [isEditing]);

    // Auto-fetch metadata when block is created with URL but no title (from paste menu)
    // Track fetched blocks globally to prevent re-fetch on component remount
    useEffect(() => {
        // Skip if no URL or not in loading state or already has title
        if (!url || !loading || title) return;

        // 使用模块级别的 Set 追踪正在 fetch 的 block，避免重复请求
        const blockId = block.id;
        if (fetchingBookmarks.has(blockId)) return;
        fetchingBookmarks.add(blockId);

        (async () => {
            try {
                const metadata = await FetchLinkMetadata(url);

                const currentBlock = editor.getBlock(block.id);
                if (currentBlock) {
                    editor.updateBlock(currentBlock, {
                        props: {
                            url,
                            title: metadata.title || url,
                            description: metadata.description || "",
                            image: metadata.image || "",
                            favicon: metadata.favicon || "",
                            siteName: metadata.siteName || "",
                            loading: false,
                            error: "",
                        },
                    });

                    // Trigger RAG indexing after successful fetch
                    if (activeId) {
                        try {
                            const blockForIndex = editor.getBlock(block.id);
                            if (blockForIndex) {
                                editor.updateBlock(blockForIndex, {
                                    props: { ...blockForIndex.props, indexing: true, indexError: "" },
                                });
                            }
                            await IndexBookmarkContent(url, activeId, block.id);
                            const latestBlock = editor.getBlock(block.id);
                            if (latestBlock) {
                                editor.updateBlock(latestBlock, {
                                    props: { ...latestBlock.props, indexed: true, indexing: false, indexError: "" },
                                });
                            }
                        } catch (err) {
                            // Indexing failed - update UI to show error
                            console.error("[BookmarkBlock] Auto-index failed:", err);
                            const errorBlock = editor.getBlock(block.id);
                            if (errorBlock) {
                                editor.updateBlock(errorBlock, {
                                    props: { ...errorBlock.props, indexing: false, indexError: "Indexing failed" },
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                const currentBlock = editor.getBlock(block.id);
                if (currentBlock) {
                    editor.updateBlock(currentBlock, {
                        props: {
                            ...currentBlock.props,
                            url,
                            loading: false,
                            error: err instanceof Error ? err.message : "Failed to fetch link metadata",
                        },
                    });
                }
            } finally {
                // 清理追踪状态，延迟5秒以防止快速重新挂载时重复请求
                setTimeout(() => {
                    fetchingBookmarks.delete(blockId);
                }, 5000);
            }
        })();
    }, [url, loading, title, block.id, editor, activeId]);

    // 索引书签内容到 RAG
    const handleIndex = useCallback(async (urlToIndex: string) => {
        if (!urlToIndex || !activeId) return;

        // 获取最新的 block 状态
        const currentBlock = editor.getBlock(block.id);
        if (!currentBlock) return;

        editor.updateBlock(currentBlock, {
            props: { ...currentBlock.props, indexing: true, indexError: "" },
        });

        try {
            await IndexBookmarkContent(urlToIndex, activeId, block.id);
            // 再次获取最新状态
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexed: true, indexing: false, indexError: "" },
                });
            }
        } catch (err) {
            console.error("[BookmarkBlock] Index failed:", err);
            const latestBlock = editor.getBlock(block.id);
            if (latestBlock) {
                editor.updateBlock(latestBlock, {
                    props: { ...latestBlock.props, indexing: false, indexError: "Failed to index" },
                });
            }
        }
    }, [block.id, editor, activeId]);

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

    const handleFetch = useCallback(async (urlToFetch: string) => {
        if (!urlToFetch.trim()) return;

        // Normalize URL (case-insensitive protocol check for auto-capitalize input methods)
        let normalizedUrl = urlToFetch.trim();
        const lowerUrl = normalizedUrl.toLowerCase();
        if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
            normalizedUrl = "https://" + normalizedUrl;
        }

        // Set loading state
        editor.updateBlock(block, {
            props: { ...block.props, url: normalizedUrl, loading: true, error: "" },
        });

        try {
            const metadata = await FetchLinkMetadata(normalizedUrl);
            editor.updateBlock(block, {
                props: {
                    url: normalizedUrl,
                    title: metadata.title || normalizedUrl,
                    description: metadata.description || "",
                    image: metadata.image || "",
                    favicon: metadata.favicon || "",
                    siteName: metadata.siteName || "",
                    loading: false,
                    error: "",
                },
            });
            setIsEditing(false);
            // 异步触发 RAG 索引
            handleIndex(normalizedUrl);
        } catch (err) {
            editor.updateBlock(block, {
                props: {
                    ...block.props,
                    url: normalizedUrl,
                    loading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch link metadata",
                },
            });
        }
    }, [block, editor, handleIndex]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            handleFetch(inputValue);
        }
    };

    // Show URL input if no URL set
    if (isEditing || !url) {
        return (
            <div className="bookmark-block bookmark-input" contentEditable={false}>
                <input
                    type="text"
                    placeholder="Enter URL..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={() => {
                        if (inputValue.trim()) {
                            handleFetch(inputValue);
                        }
                    }}
                    ref={inputRef}
                />
            </div>
        );
    }

    // Show loading state
    if (loading) {
        return (
            <div className="bookmark-block bookmark-loading" contentEditable={false}>
                <div className="bookmark-spinner"></div>
                <span>Fetching link info...</span>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="bookmark-block bookmark-error" contentEditable={false}>
                <span className="error-icon">!</span>
                <span>{error}</span>
                <button onClick={() => setIsEditing(true)}>Retry</button>
            </div>
        );
    }

    // Render bookmark card
    return (
        <div
            className={`bookmark-block bookmark-card ${indexed ? 'indexed' : ''} ${indexError ? 'index-error' : ''}`}
            contentEditable={false}
            onDoubleClick={() => BrowserOpenURL(url)}
        >
            <div className="bookmark-content">
                <div className="bookmark-title">{title || url}</div>
                {description && (
                    <div className="bookmark-description">{description}</div>
                )}
                <div className="bookmark-meta">
                    {favicon && (
                        <img
                            src={favicon}
                            alt=""
                            className="bookmark-favicon"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    )}
                    <span className="bookmark-domain">{siteName || new URL(url).hostname}</span>
                </div>
            </div>
            {image && (
                <div className="bookmark-image">
                    <img
                        src={image}
                        alt=""
                        onError={(e) => {
                            (e.target as HTMLImageElement).parentElement!.style.display = "none";
                        }}
                    />
                </div>
            )}
            {/* 右上角的操作按钮 */}
            <div className="bookmark-actions">
                <button
                    className={`bookmark-action-btn ${indexed ? 'indexed' : ''} ${indexError ? 'index-error' : ''}`}
                    title={indexing ? "Indexing..." : indexed ? "Re-index content" : indexError ? "Indexing failed, retry?" : "Index content"}
                    disabled={indexing}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleIndex(url);
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
                        className="bookmark-action-btn"
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
                    className="bookmark-action-btn"
                    title="Edit"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setInputValue(url);
                        setIsEditing(true);
                    }}
                >
                    <Pencil size={14} />
                </button>
                <button
                    className="bookmark-action-btn"
                    title="Open link"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        BrowserOpenURL(url);
                    }}
                >
                    <ExternalLink size={14} />
                </button>
            </div>
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
        </div>
    );
};

// BookmarkBlock component
export const BookmarkBlock = createReactBlockSpec(
    {
        type: "bookmark",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            url: { default: "" },
            title: { default: "" },
            description: { default: "" },
            image: { default: "" },
            favicon: { default: "" },
            siteName: { default: "" },
            loading: { default: false },
            error: { default: "" },
            indexed: { default: false },
            indexing: { default: false },
            indexError: { default: "" },
        },
        content: "none",
    },
    {
        render: BookmarkBlockComponent,
        toExternalHTML: (props) => {
            const { url, title } = props.block.props;
            if (!url) return <span />;
            const label = title?.trim() ? title : url;
            return (
                <a href={url} target="_blank" rel="noopener noreferrer">
                    {label}
                </a>
            );
        },
    }
);
