import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

// Define locally to avoid circular import with SidebarSearch.tsx
interface SearchInputRef {
    focus: () => void;
}

interface SearchContextValue {
    query: string;
    setQuery: (query: string) => void;
    setQueryWithFocus: (query: string) => void;
    focusSearch: () => void;
    registerSearchRef: (ref: SearchInputRef | null) => void;
    // 排除当前文档
    excludeCurrentDoc: boolean;
    setExcludeCurrentDoc: (exclude: boolean) => void;
    // 设置查询并聚焦，同时启用排除当前文档
    setQueryWithExclude: (query: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [query, setQueryState] = useState('');
    const [excludeCurrentDoc, setExcludeCurrentDoc] = useState(false);
    const searchRef = useRef<SearchInputRef | null>(null);

    const setQuery = useCallback((newQuery: string) => {
        setQueryState(newQuery);
    }, []);

    const setQueryWithFocus = useCallback((newQuery: string) => {
        setQueryState(newQuery);
        // 延迟聚焦以确保状态更新
        requestAnimationFrame(() => {
            searchRef.current?.focus();
        });
    }, []);

    const focusSearch = useCallback(() => {
        searchRef.current?.focus();
    }, []);

    const registerSearchRef = useCallback((ref: SearchInputRef | null) => {
        searchRef.current = ref;
    }, []);

    // 设置查询并聚焦，同时启用排除当前文档
    const setQueryWithExclude = useCallback((newQuery: string) => {
        setQueryState(newQuery);
        setExcludeCurrentDoc(true);
        requestAnimationFrame(() => {
            searchRef.current?.focus();
        });
    }, []);

    return (
        <SearchContext.Provider
            value={{
                query,
                setQuery,
                setQueryWithFocus,
                focusSearch,
                registerSearchRef,
                excludeCurrentDoc,
                setExcludeCurrentDoc,
                setQueryWithExclude,
            }}
        >
            {children}
        </SearchContext.Provider>
    );
}

export function useSearchContext() {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error('useSearchContext must be used within a SearchProvider');
    }
    return context;
}
