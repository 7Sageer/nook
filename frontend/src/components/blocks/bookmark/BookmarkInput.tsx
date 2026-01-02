import { RefObject } from "react";

interface BookmarkInputProps {
    inputValue: string;
    setInputValue: (val: string) => void;
    onFetch: (url: string) => void;
    inputRef: RefObject<HTMLInputElement>;
}

export const BookmarkInput = ({ inputValue, setInputValue, onFetch, inputRef }: BookmarkInputProps) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            onFetch(inputValue);
        }
    };

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
                        onFetch(inputValue);
                    }
                }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                ref={inputRef}
            />
        </div>
    );
};
