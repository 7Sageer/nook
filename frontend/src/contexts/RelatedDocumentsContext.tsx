import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FindRelatedDocuments } from '../../wailsjs/go/main/App';
import type { DocumentSearchResult } from '../types/document';

interface RelatedViewState {
    sourceContent: string;
    results: DocumentSearchResult[];
    isLoading: boolean;
}

interface RelatedDocumentsContextValue {
    relatedView: RelatedViewState | null;
    findRelated: (content: string, excludeDocID: string) => void;
    exitRelatedView: () => void;
}

const RelatedDocumentsContext = createContext<RelatedDocumentsContextValue | null>(null);

export function RelatedDocumentsProvider({ children }: { children: ReactNode }) {
    const [relatedView, setRelatedView] = useState<RelatedViewState | null>(null);

    const findRelated = useCallback(async (content: string, excludeDocID: string) => {
        if (!content.trim()) return;

        // Set loading state
        setRelatedView({
            sourceContent: content,
            results: [],
            isLoading: true,
        });

        try {
            const results = await FindRelatedDocuments(content, 5, excludeDocID);
            setRelatedView({
                sourceContent: content,
                results: results || [],
                isLoading: false,
            });
        } catch (err) {
            console.error('[RelatedDocuments] Search failed:', err);
            setRelatedView({
                sourceContent: content,
                results: [],
                isLoading: false,
            });
        }
    }, []);

    const exitRelatedView = useCallback(() => {
        setRelatedView(null);
    }, []);

    return (
        <RelatedDocumentsContext.Provider value={{ relatedView, findRelated, exitRelatedView }}>
            {children}
        </RelatedDocumentsContext.Provider>
    );
}

export function useRelatedDocuments() {
    const context = useContext(RelatedDocumentsContext);
    if (!context) {
        throw new Error('useRelatedDocuments must be used within a RelatedDocumentsProvider');
    }
    return context;
}
