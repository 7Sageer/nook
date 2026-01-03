import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SearchResult, DocumentSearchResult } from '../types/document';
import { SearchDocuments, SemanticSearchDocuments } from '../../wailsjs/go/main/App';
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
    // 存储原始搜索结果（未过滤）
    const [rawResults, setRawResults] = useState<SearchResult[]>([]);
    const [rawSemanticResults, setRawSemanticResults] = useState<DocumentSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSemantic, setIsLoadingSemantic] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 记录搜索时排除的文档 ID（用于语义搜索）
    const excludedDocIdRef = useRef<string>("");

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
            setRawSemanticResults([]); // Clear previous semantic results while loading new ones

            // 1. Instant Keyword Search (不在后端过滤，前端过滤)
            SearchDocuments(query)
                .then(searchResults => {
                    setRawResults(searchResults || []);
                })
                .catch(error => {
                    console.error('Keyword search failed:', error);
                    setRawResults([]);
                })
                .finally(() => setIsSearching(false));

            // 2. Debounced Semantic Search (Document-level)
            // 记录当前排除的文档 ID
            excludedDocIdRef.current = (excludeCurrentDoc && activeId) ? activeId : "";
            debounceRef.current = setTimeout(async () => {
                try {
                    const semResults = await SemanticSearchDocuments(query, 5, excludedDocIdRef.current);
                    setRawSemanticResults(semResults || []);
                } catch (error) {
                    console.error('Semantic search failed:', error);
                    setRawSemanticResults([]);
                } finally {
                    setIsLoadingSemantic(false);
                }
            }, 500); // 500ms debounce
        } else {
            setRawResults([]);
            setRawSemanticResults([]);
            setIsSearching(false);
            setIsLoadingSemantic(false);
        }

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, excludeCurrentDoc]); // 移除 activeId 依赖，避免导航时重新搜索

    // 前端过滤：根据 excludeCurrentDoc 和 activeId 过滤关键词搜索结果
    const results = useMemo(() => {
        if (excludeCurrentDoc && activeId) {
            return rawResults.filter(r => r.id !== activeId);
        }
        return rawResults;
    }, [rawResults, excludeCurrentDoc, activeId]);

    // 语义搜索结果（已在后端过滤，直接使用）
    const semanticResults = rawSemanticResults;

    const clearSearch = useCallback(() => {
        setContextQuery('');
        setRawResults([]);
        setRawSemanticResults([]);
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
