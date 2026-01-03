import { AlertCircle } from "lucide-react";

interface BookmarkErrorProps {
    error: string;
    onRetry: () => void;
}

export const BookmarkError = ({ error, onRetry }: BookmarkErrorProps) => {
    return (
        <div className="external-block external-error" contentEditable={false}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={onRetry} style={{ marginLeft: "auto", padding: "4px 8px", cursor: "pointer" }}>Retry</button>
        </div>
    );
};
