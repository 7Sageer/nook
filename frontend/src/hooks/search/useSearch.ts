import { useState, useCallback, useEffect, useMemo } from 'react';
import { SearchResult, DocumentSearchResult } from '../../types/document';
import { SearchDocuments, SemanticSearchDocuments } from '../../../wailsjs/go/main/App';
import { useSearchContext } from '../../contexts/SearchContext';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useDebounce } from '../ui/useDebounce';

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

    // 精细化的排除ID逻辑：
    // - 只有当 excludeCurrentDoc 开启时，activeId 变化才应触发重新搜索
    // - 普通搜索时（excludeCurrentDoc = false），点击结果跳转不应重新搜索
    const effectiveExcludeId = excludeCurrentDoc ? activeId : null;

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
            // effectiveExcludeId 已经包含了精细化逻辑
            const currentExcludeId = effectiveExcludeId || "";
            performSemanticSearch(query, currentExcludeId);
        } else {
            setRawResults([]);
            setRawSemanticResults([]);
            setIsSearching(false);
            setIsLoadingSemantic(false);
        }
    }, [query, effectiveExcludeId, performSemanticSearch]);
    // effectiveExcludeId 精细化依赖：
    // - excludeCurrentDoc=false 时：effectiveExcludeId=null（不变）→ activeId 变化不触发搜索
    // - excludeCurrentDoc=true 时：effectiveExcludeId=activeId → activeId 变化触发搜索

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
