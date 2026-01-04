import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { SearchResult, DocumentSearchResult } from '../types/document';
import { SearchDocuments, SemanticSearchDocuments } from '../../wailsjs/go/main/App';
import { useSearchContext } from '../contexts/SearchContext';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useDebounce } from './useDebounce';

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
    // 使用 ref 保存 activeId，避免 activeId 变化时触发重新搜索
    const activeIdRef = useRef(activeId);
    activeIdRef.current = activeId;

    // 存储原始搜索结果（未过滤）
    const [rawResults, setRawResults] = useState<SearchResult[]>([]);
    const [rawSemanticResults, setRawSemanticResults] = useState<DocumentSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSemantic, setIsLoadingSemantic] = useState(false);

    // Semantic search debounced function
    const performSemanticSearch = useDebounce(async (searchQuery: string, excludeId: string) => {
        try {
            const semResults = await SemanticSearchDocuments(searchQuery, 5, excludeId);
            setRawSemanticResults(semResults || []);
        } catch (error) {
            console.error('Semantic search failed:', error);
            setRawSemanticResults([]);
        } finally {
            setIsLoadingSemantic(false);
        }
    }, 500);

    // React to query changes from context
    useEffect(() => {
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
            // 使用 ref 获取最新的 activeId，避免 activeId 变化时重新触发搜索
            const currentExcludeId = (excludeCurrentDoc && activeIdRef.current) ? activeIdRef.current : "";
            performSemanticSearch(query, currentExcludeId);
        } else {
            setRawResults([]);
            setRawSemanticResults([]);
            setIsSearching(false);
            setIsLoadingSemantic(false);
        }
    }, [query, excludeCurrentDoc, performSemanticSearch]);
    // 注意：activeId 被故意从依赖项中移除
    // 当点击搜索结果跳转到文档时，activeId 会改变，但我们不希望这触发重新搜索
    // 使用 activeIdRef.current 可以在需要时获取最新值，同时避免不必要的 effect 重新执行

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
        performSemanticSearch.cancel();
    }, [setContextQuery, performSemanticSearch]);

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
