import React from 'react';
import { RefreshCw } from 'lucide-react';
import { getStrings } from '../../constants/strings';
import type { RAGStatus } from '../../types/settings';

interface KnowledgePanelProps {
    status: RAGStatus;
    isRebuilding: boolean;
    onRebuild: () => void;
    strings: ReturnType<typeof getStrings>;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
    status,
    isRebuilding,
    onRebuild,
    strings,
}) => (
    <div className="settings-panel">
        <h3>{strings.SETTINGS.KNOWLEDGE_BASE}</h3>

        <div className="settings-status-card">
            <div className="status-row">
                <span className="status-label">{strings.SETTINGS.INDEX_STATUS}</span>
                <span className="status-value">
                    {status.indexedDocs} / {status.totalDocs} {strings.SETTINGS.DOCUMENTS}
                </span>
            </div>
            <div className="status-row">
                <span className="status-label">{strings.SETTINGS.INDEXED_BOOKMARKS || "Indexed Bookmarks"}</span>
                <span className="status-value">
                    {status.indexedBookmarks || 0}
                </span>
            </div>
            <div className="status-row">
                <span className="status-label">{strings.SETTINGS.INDEXED_FILES || "Indexed Files"}</span>
                <span className="status-value">
                    {status.indexedFiles || 0}
                </span>
            </div>
            {status.lastIndexTime && (
                <div className="status-row">
                    <span className="status-label">{strings.SETTINGS.LAST_UPDATE}</span>
                    <span className="status-value">{status.lastIndexTime}</span>
                </div>
            )}
        </div>

        <button
            className="settings-action-btn"
            onClick={onRebuild}
            disabled={isRebuilding}
        >
            <RefreshCw size={16} className={isRebuilding ? 'spinning' : ''} />
            <span>
                {isRebuilding
                    ? strings.SETTINGS.REBUILDING
                    : strings.SETTINGS.REBUILD_INDEX}
            </span>
        </button>
    </div>
);
