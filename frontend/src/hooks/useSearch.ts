import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResult, DocumentSearchResult } from '../types/document';
import { SearchDocuments, SemanticSearchDocuments, FindRelatedDocuments } from '../../wailsjs/go/main/App';
import { useSearchContext } from '../contexts/SearchContext';
import { useDocumentContext } from '../contexts/DocumentContext';

interface UseSearchReturn {
    query: string;
    results: SearchResult[];
    semanticResults: DocumentSearchResult[];
    isSearching: boolean;
    isLoadingSemantic: boolean;
    setQuery: (query: string) => void;
    clearSearch: () => void;
}

export function useSearch(): UseSearchReturn {
    const { query, setQuery: setContextQuery, excludeCurrentDoc } = useSearchContext();
    const { activeId } = useDocumentContext();
    const [results, setResults] = useState<SearchResult[]>([]);
    const [semanticResults, setSemanticResults] = useState<DocumentSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSemantic, setIsLoadingSemantic] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // React to query changes from context
    useEffect(() => {
        // Clear previous debounced timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }

        if (query.trim()) {
            setIsSearching(true);
            setIsLoadingSemantic(true);
            setSemanticResults([]); // Clear previous semantic results while loading new ones

            // 1. Instant Keyword Search
            SearchDocuments(query)
                .then(searchResults => {
                    // 如果启用排除当前文档，过滤掉当前文档
                    if (excludeCurrentDoc && activeId) {
                        setResults(searchResults.filter(r => r.id !== activeId));
                    } else {
                        setResults(searchResults);
                    }
                })
                .catch(error => {
                    console.error('Keyword search failed:', error);
                    setResults([]);
                })
                .finally(() => setIsSearching(false));

            // 2. Debounced Semantic Search (Document-level)
            debounceRef.current = setTimeout(async () => {
                try {
                    let semResults: DocumentSearchResult[];
                    if (excludeCurrentDoc && activeId) {
                        // 使用 FindRelatedDocuments 来排除当前文档
                        semResults = await FindRelatedDocuments(query, 5, activeId);
                    } else {
                        semResults = await SemanticSearchDocuments(query, 5);
                    }
                    setSemanticResults(semResults || []);
                } catch (error) {
                    console.error('Semantic search failed:', error);
                    setSemanticResults([]);
                } finally {
                    setIsLoadingSemantic(false);
                }
            }, 500); // 500ms debounce
        } else {
            setResults([]);
            setSemanticResults([]);
            setIsSearching(false);
            setIsLoadingSemantic(false);
        }

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, excludeCurrentDoc, activeId]);

    const clearSearch = useCallback(() => {
        setContextQuery('');
        setResults([]);
        setSemanticResults([]);
        setIsLoadingSemantic(false);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
    }, [setContextQuery]);

    return {
        query,
        results,
        semanticResults,
        isSearching,
        isLoadingSemantic,
        setQuery: setContextQuery,
        clearSearch,
    };
}
