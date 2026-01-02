import { useState, useRef, useEffect, useCallback } from "react";
import { FetchLinkMetadata, IndexBookmarkContent, GetExternalBlockContent } from "../../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

// Module-level state to track fetching bookmarks to prevent duplicate requests
const fetchingBookmarks = new Set<string>();

export const useBookmarkState = (block: any, editor: any, activeId: string | null) => {
    const { url, title, loading, error, indexed, indexing, indexError } = block.props;

    const [inputValue, setInputValue] = useState(url || "");
    const [isEditing, setIsEditing] = useState(!url);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Content modal state
    const [showContentModal, setShowContentModal] = useState(false);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState("");
    const [extractedContent, setExtractedContent] = useState("");

    // Enter edit mode if URL is cleared externally
    useEffect(() => {
        if (!url && !isEditing) {
            setIsEditing(true);
        }
    }, [url, isEditing]);

    // Handle focus and virtual caret when editing
    useEffect(() => {
        if (!isEditing) return;
        const caretEl = document.querySelector('[data-smooth-caret]') as HTMLElement;
        if (caretEl) caretEl.style.display = 'none';

        const raf = requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
        return () => {
            cancelAnimationFrame(raf);
            if (caretEl) caretEl.style.display = '';
        };
    }, [isEditing]);

    // Auto-fetch metadata
    useEffect(() => {
        if (!url || !loading || title) return;

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

                    // Trigger RAG indexing
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
                setTimeout(() => {
                    fetchingBookmarks.delete(blockId);
                }, 5000);
            }
        })();
    }, [url, loading, title, block.id, editor, activeId]);

    // Index bookmark content
    const handleIndex = useCallback(async (urlToIndex: string) => {
        if (!urlToIndex || !activeId) return;

        const currentBlock = editor.getBlock(block.id);
        if (!currentBlock) return;

        editor.updateBlock(currentBlock, {
            props: { ...currentBlock.props, indexing: true, indexError: "" },
        });

        try {
            await IndexBookmarkContent(urlToIndex, activeId, block.id);
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

    // View extracted content
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

    // Fetch implementation
    const handleFetch = useCallback(async (urlToFetch: string) => {
        if (!urlToFetch.trim()) return;

        let normalizedUrl = urlToFetch.trim();
        const lowerUrl = normalizedUrl.toLowerCase();
        if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
            normalizedUrl = "https://" + normalizedUrl;
        }

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

    return {
        inputValue,
        setInputValue,
        isEditing,
        setIsEditing,
        inputRef,
        showContentModal,
        setShowContentModal,
        contentLoading,
        contentError,
        extractedContent,
        handleIndex,
        handleViewContent,
        handleFetch
    };
};
