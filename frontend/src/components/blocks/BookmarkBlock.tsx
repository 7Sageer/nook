import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useDocumentContext } from "../../contexts/DocumentContext";
import { ContentViewerModal } from "../modals/ContentViewerModal";
import "../../styles/ExternalBlock.css";
import "../../styles/BookmarkBlock.css";

import { useBookmarkState } from "./useBookmarkState";
import { BookmarkInput } from "./bookmark/BookmarkInput";
import { BookmarkLoading } from "./bookmark/BookmarkLoading";
import { BookmarkError } from "./bookmark/BookmarkError";
import { BookmarkCard } from "./bookmark/BookmarkCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BookmarkBlockComponent = (props: { block: any, editor: any }) => {
    const { block, editor } = props;
    const { url, title, description, image, favicon, siteName, loading, error, indexed, indexing, indexError } = block.props;
    const { activeId } = useDocumentContext();

    const {
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
    } = useBookmarkState(block, editor, activeId);

    // Show URL input if no URL set or editing
    if (isEditing || !url) {
        return (
            <BookmarkInput
                inputValue={inputValue}
                setInputValue={setInputValue}
                onFetch={handleFetch}
                inputRef={inputRef}
            />
        );
    }

    // Show loading state
    if (loading) {
        return <BookmarkLoading />;
    }

    // Show error state
    if (error) {
        return <BookmarkError error={error} onRetry={() => setIsEditing(true)} />;
    }

    // Render bookmark card
    return (
        <>
            <BookmarkCard
                title={title}
                description={description}
                image={image}
                favicon={favicon}
                siteName={siteName}
                url={url}
                indexed={indexed}
                indexing={indexing}
                indexError={indexError}
                onIndex={handleIndex}
                onViewContent={handleViewContent}
                onEdit={() => {
                    setInputValue(url);
                    setIsEditing(true);
                }}
            />
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
        </>
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
