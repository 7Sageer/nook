import { ArrowLeft, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DocumentSearchResult } from '../types/document';
import './RelatedDocumentsView.css';

interface RelatedDocumentsViewProps {
    sourceContent: string;
    results: DocumentSearchResult[];
    isLoading: boolean;
    onSelectDocument: (docId: string, blockId: string) => void;
    onBack: () => void;
}

export function RelatedDocumentsView({
    sourceContent,
    results,
    isLoading,
    onSelectDocument,
    onBack,
}: RelatedDocumentsViewProps) {
    // Truncate source content for display
    const truncatedSource = sourceContent.length > 60
        ? sourceContent.slice(0, 60) + '...'
        : sourceContent;

    return (
        <div className="related-documents-view">
            {/* Header */}
            <div className="related-header">
                <button className="back-button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>
                <span className="related-title">
                    <Sparkles size={14} className="related-icon" />
                    Related Docs
                </span>
            </div>

            {/* Source indicator */}
            <div className="related-source">
                <span className="source-label">Based on:</span>
                <span className="source-content" title={sourceContent}>
                    "{truncatedSource}"
                </span>
            </div>

            {/* Results */}
            <div className="related-results">
                {isLoading ? (
                    <div className="related-loading">
                        <div className="loading-spinner" />
                        <span>Finding related documents...</span>
                    </div>
                ) : results.length === 0 ? (
                    <div className="related-empty">
                        <span>No related documents found</span>
                    </div>
                ) : (
                    <ul className="related-list">
                        <AnimatePresence mode="popLayout">
                            {results.map((doc, index) => (
                                <motion.li
                                    key={doc.docId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="related-item"
                                    onClick={() => onSelectDocument(
                                        doc.docId,
                                        doc.matchedChunks[0]?.sourceBlockId || ''
                                    )}
                                >
                                    <FileText size={16} className="doc-icon" />
                                    <div className="related-item-content">
                                        <span className="related-item-title">
                                            {doc.docTitle || 'Untitled'}
                                        </span>
                                        {doc.matchedChunks[0]?.content && (
                                            <span className="related-item-snippet">
                                                {doc.matchedChunks[0].content.slice(0, 80)}...
                                            </span>
                                        )}
                                    </div>
                                    <span className="related-item-score">
                                        {Math.round(doc.maxScore * 100)}%
                                    </span>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </div>
        </div>
    );
}
