import { Loader2 } from "lucide-react";

export const BookmarkLoading = () => {
    return (
        <div className="external-block external-loading" contentEditable={false}>
            <Loader2 size={18} className="animate-spin" />
            <span>Fetching link info...</span>
        </div>
    );
};
