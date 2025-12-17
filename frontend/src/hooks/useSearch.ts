import { useState, useCallback } from 'react';
import { SearchResult } from '../types/document';
import { SearchDocuments } from '../../wailsjs/go/main/App';

interface UseSearchReturn {
    query: string;
    results: SearchResult[];
    isSearching: boolean;
    setQuery: (query: string) => void;
    clearSearch: () => void;
}

export function useSearch(): UseSearchReturn {
    const [query, setQueryState] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const setQuery = useCallback(async (newQuery: string) => {
        setQueryState(newQuery);
        if (newQuery.trim()) {
            setIsSearching(true);
            try {
                const searchResults = await SearchDocuments(newQuery);
                setResults(searchResults);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        } else {
            setResults([]);
        }
    }, []);

    const clearSearch = useCallback(() => {
        setQueryState('');
        setResults([]);
    }, []);

    return {
        query,
        results,
        isSearching,
        setQuery,
        clearSearch,
    };
}
