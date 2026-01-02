export const BookmarkLoading = () => {
    return (
        <div className="bookmark-block bookmark-loading" contentEditable={false}>
            <div className="bookmark-spinner"></div>
            <span>Fetching link info...</span>
        </div>
    );
};
