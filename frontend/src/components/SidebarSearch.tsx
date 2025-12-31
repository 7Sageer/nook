import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { STRINGS } from '../constants/strings';
import { useSearchContext } from '../contexts/SearchContext';

interface SidebarSearchProps {
    onQueryChange: (query: string) => void;
}

export interface SidebarSearchRef {
    focus: () => void;
}

export const SidebarSearch = forwardRef<SidebarSearchRef, SidebarSearchProps>(({ onQueryChange }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { query, setQuery, registerSearchRef } = useSearchContext();

    // 注册到 SearchContext
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        }
    }));

    // 注册 ref 到 context
    useEffect(() => {
        const searchRef = {
            focus: () => inputRef.current?.focus()
        };
        registerSearchRef(searchRef);
        return () => registerSearchRef(null);
    }, [registerSearchRef]);

    // 同步 query 到父组件
    useEffect(() => {
        onQueryChange(query);
    }, [query, onQueryChange]);

    const handleClear = () => {
        setQuery('');
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setQuery('');
            inputRef.current?.blur();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
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
                onChange={handleInputChange}
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
});
