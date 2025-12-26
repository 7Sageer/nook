import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { STRINGS } from '../constants/strings';

interface SidebarSearchProps {
    query: string;
    onQueryChange: (query: string) => void;
}

export function SidebarSearch({ query, onQueryChange }: SidebarSearchProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = () => {
        onQueryChange('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onQueryChange('');
            inputRef.current?.blur();
        }
    };

    return (
        <div className="search-wrapper" role="search">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder={STRINGS.LABELS.SEARCH_PLACEHOLDER}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label={STRINGS.LABELS.SEARCH_PLACEHOLDER}
            />
            {query && (
                <button
                    type="button"
                    className="search-clear-btn"
                    onClick={handleClear}
                    aria-label="Clear search"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
