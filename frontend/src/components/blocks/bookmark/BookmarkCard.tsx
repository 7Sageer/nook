import { Pencil, ExternalLink, RefreshCw, Check, Loader2, AlertCircle, Eye } from "lucide-react";
import { BrowserOpenURL } from "../../../../wailsjs/runtime/runtime";

interface BookmarkCardProps {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    url: string;
    indexed?: boolean;
    indexing?: boolean;
    indexError?: string;
    onIndex: (url: string) => void;
    onViewContent: () => void;
    onEdit: () => void;
}

export const BookmarkCard = ({
    title,
    description,
    image,
    favicon,
    siteName,
    url,
    indexed,
    indexing,
    indexError,
    onIndex,
    onViewContent,
    onEdit,
}: BookmarkCardProps) => {
    return (
        <div
            className={`external-block external-card ${indexed ? 'indexed' : ''} ${indexError ? 'index-error' : ''} bookmark-card-custom`}
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
            <div className="external-actions">
                <button
                    className={`external-action-btn ${indexed ? 'indexed' : ''} ${indexError ? 'index-error' : ''}`}
                    title={indexing ? "Indexing..." : indexed ? "Re-index content" : indexError ? "Indexing failed, retry?" : "Index content"}
                    disabled={indexing}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onIndex(url);
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
                            onViewContent();
                        }}
                    >
                        <Eye size={14} />
                    </button>
                )}
                <button
                    className="external-action-btn"
                    title="Edit"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEdit();
                    }}
                >
                    <Pencil size={14} />
                </button>
                <button
                    className="external-action-btn"
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
        </div>
    );
};
