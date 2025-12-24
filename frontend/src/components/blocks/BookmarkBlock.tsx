import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pencil, ExternalLink } from "lucide-react";
import { FetchLinkMetadata } from "../../../wailsjs/go/main/App";
import "../../styles/BookmarkBlock.css";

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
        },
        content: "none",
    },
    {
        render: (props) => {
            const { block, editor } = props;
            const { url, title, description, image, favicon, siteName, loading, error } = block.props;

            const [inputValue, setInputValue] = useState(url || "");
            const [isEditing, setIsEditing] = useState(!url);
            const inputRef = useRef<HTMLInputElement | null>(null);

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

            const handleFetch = useCallback(async (urlToFetch: string) => {
                if (!urlToFetch.trim()) return;

                // Normalize URL
                let normalizedUrl = urlToFetch.trim();
                if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
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
            }, [block, editor]);

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
                    className="bookmark-block bookmark-card"
                    contentEditable={false}
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
                    <div className="bookmark-actions">
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
                                window.open(url, "_blank");
                            }}
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            );
        },
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
