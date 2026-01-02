interface BookmarkErrorProps {
    error: string;
    onRetry: () => void;
}

export const BookmarkError = ({ error, onRetry }: BookmarkErrorProps) => {
    return (
        <div className="bookmark-block bookmark-error" contentEditable={false}>
            <span className="error-icon">!</span>
            <span>{error}</span>
            <button onClick={onRetry}>Retry</button>
        </div>
    );
};
