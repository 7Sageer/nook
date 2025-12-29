import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResult, SemanticSearchResult } from '../types/document';
import { SearchDocuments, SemanticSearch } from '../../wailsjs/go/main/App';

interface UseSearchReturn {
    query: string;
    results: SearchResult[];
    semanticResults: SemanticSearchResult[];
    isSearching: boolean;
    isLoadingSemantic: boolean;
    setQuery: (query: string) => void;
    clearSearch: () => void;
}

export function useSearch(): UseSearchReturn {
    const [query, setQueryState] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSemantic, setIsLoadingSemantic] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cancel pending semantic search on unmount or new query
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const setQuery = useCallback(async (newQuery: string) => {
        setQueryState(newQuery);

        // Clear previous debounced timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }

        if (newQuery.trim()) {
            setIsSearching(true);
            setIsLoadingSemantic(true);
            setSemanticResults([]); // Clear previous semantic results while loading new ones

            try {
                // 1. Instant Keyword Search
                SearchDocuments(newQuery)
                    .then(searchResults => setResults(searchResults))
                    .catch(error => {
                        console.error('Keyword search failed:', error);
                        setResults([]);
                    })
                    .finally(() => setIsSearching(false));

                // 2. Debounced Semantic Search
                debounceRef.current = setTimeout(async () => {
                    try {
                        const semResults = await SemanticSearch(newQuery, 5); // Limit to 5
                        setSemanticResults(semResults || []);
                    } catch (error) {
                        console.error('Semantic search failed:', error);
                        setSemanticResults([]);
                    } finally {
                        setIsLoadingSemantic(false);
                    }
                }, 500); // 500ms debounce

            } catch (error) {
                // Fallback catch
                console.error('Search initiation failed:', error);
                setIsSearching(false);
                setIsLoadingSemantic(false);
            }
        } else {
            setResults([]);
            setSemanticResults([]);
            setIsSearching(false);
            setIsLoadingSemantic(false);
        }
    }, []);

    const clearSearch = useCallback(() => {
        setQueryState('');
        setResults([]);
        setSemanticResults([]);
        setIsLoadingSemantic(false);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
    }, []);

    return {
        query,
        results,
        semanticResults,
        isSearching,
        isLoadingSemantic,
        setQuery,
        clearSearch,
    };
}
