import { Sparkles } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { DocumentList } from './DocumentList';
import { SearchResultItem } from './SearchResultItem';
import type { DocumentSearchResult, SearchResult } from '../types/document';

interface SidebarSearchResultsProps {
    query: string;
    semanticResults: DocumentSearchResult[];
    keywordResults: SearchResult[];
    isLoadingSemantic: boolean;
    isSearching: boolean;
    activeId: string | null;
    activeExternalPath: string | null;
    onSelectSemantic: (docId: string, blockId: string) => void;
    onSelectKeyword: (id: string) => void;
    strings: {
        LABELS: {
            DOCUMENTS?: string;
        };
    };
}

/**
 * Renders search results in the sidebar, including both semantic and keyword matches.
 */
export function SidebarSearchResults({
    query,
    semanticResults,
    keywordResults,
    isLoadingSemantic,
    isSearching,
    activeId,
    activeExternalPath,
    onSelectSemantic,
    onSelectKeyword,
    strings,
}: SidebarSearchResultsProps) {
    return (
        <div className="search-results-container">
            {/* 1. Semantic Matches */}
            <div className="search-section semantic-section">
                <div className="section-label-row">
                    <span className="section-label">
                        <Sparkles size={12} className="semantic-icon" />
                        Semantic Matches
                    </span>
                    {isLoadingSemantic && <span className="loading-spinner-tiny"></span>}
                </div>
                {semanticResults.length > 0 ? (
                    <ul className="document-list semantic-list">
                        <AnimatePresence mode="popLayout">
                            {semanticResults.map((res, index) => (
                                <SearchResultItem
                                    key={res.docId}
                                    index={index}
                                    title={res.docTitle}
                                    snippet={res.matchedChunks[0]?.content || ''}
                                    matchCount={res.matchedChunks.length}
                                    isActive={false}
                                    variant="semantic"
                                    onClick={() => onSelectSemantic(res.docId, res.matchedChunks[0]?.sourceBlockId || '')}
                                    allChunks={res.matchedChunks}
                                    onChunkClick={(blockId) => onSelectSemantic(res.docId, blockId)}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                ) : (
                    !isLoadingSemantic && query.length > 2 && (
                        <div className="search-empty-state">
                            No semantic matches found
                        </div>
                    )
                )}
            </div>

            {/* 2. Keyword Matches */}
            <div className="search-section">
                <div className="section-label-row">
                    <span className="section-label">{strings.LABELS.DOCUMENTS || "Documents"}</span>
                </div>
                {keywordResults.length > 0 ? (
                    <ul className="document-list" role="listbox">
                        <DocumentList
                            items={keywordResults}
                            activeId={activeExternalPath ? null : activeId}
                            isSearchMode={true}
                            onSelect={onSelectKeyword}
                            onDelete={() => { }}
                            sortable={false}
                            containerId="search-results"
                        />
                    </ul>
                ) : (
                    <div className="search-empty-state">
                        {isSearching ? "Searching..." : "No exact matches found"}
                    </div>
                )}
            </div>
        </div>
    );
}
