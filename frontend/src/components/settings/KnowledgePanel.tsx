import React from 'react';
import { RefreshCw } from 'lucide-react';
import { getStrings } from '../../constants/strings';
import type { RAGStatus } from '../../types/settings';

export interface ReindexProgress {
    phase: 'documents' | 'external';
    current: number;
    total: number;
}

interface KnowledgePanelProps {
    status: RAGStatus;
    isRebuilding: boolean;
    progress: ReindexProgress | null;
    onRebuild: () => void;
    strings: ReturnType<typeof getStrings>;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
    status,
    isRebuilding,
    progress,
    onRebuild,
    strings,
}) => {
    // 获取进度显示文本
    const getProgressText = () => {
        if (!progress) return strings.SETTINGS.REBUILDING;
        const phaseText = progress.phase === 'documents'
            ? (strings.SETTINGS.INDEXING_DOCUMENTS || 'Indexing documents')
            : (strings.SETTINGS.INDEXING_EXTERNAL || 'Indexing external content');
        return `${phaseText} ${progress.current}/${progress.total}...`;
    };

    // 计算进度百分比
    const getProgressPercent = () => {
        if (!progress || progress.total === 0) return 0;
        return Math.round((progress.current / progress.total) * 100);
    };

    return (
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
                <div className="status-row">
                    <span className="status-label">{strings.SETTINGS.INDEXED_FOLDERS || "Indexed Folders"}</span>
                    <span className="status-value">
                        {status.indexedFolders || 0}
                    </span>
                </div>
                {status.lastIndexTime && (
                    <div className="status-row">
                        <span className="status-label">{strings.SETTINGS.LAST_UPDATE}</span>
                        <span className="status-value">{status.lastIndexTime}</span>
                    </div>
                )}
            </div>

            {/* 进度条 */}
            {isRebuilding && progress && (
                <div className="reindex-progress">
                    <div className="progress-text">{getProgressText()}</div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${getProgressPercent()}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="settings-action-buttons">
                <button
                    className="settings-action-btn"
                    onClick={onRebuild}
                    disabled={isRebuilding}
                >
                    <RefreshCw size={16} className={isRebuilding ? 'spinning' : ''} />
                    <span>
                        {isRebuilding
                            ? getProgressText()
                            : strings.SETTINGS.REBUILD_INDEX}
                    </span>
                </button>
            </div>
        </div>
    );
};
