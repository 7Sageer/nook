import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { X, Database, Bot, Palette, Terminal, Info } from 'lucide-react';
import { GetRAGConfig, SaveRAGConfig, GetRAGStatus, RebuildIndex, GetMCPInfo } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { getStrings } from '../constants/strings';
import type { EmbeddingConfig, RAGStatus, MCPInfo } from '../types/settings';
import { AppearancePanel } from './settings/AppearancePanel';
import { KnowledgePanel, ReindexProgress } from './settings/KnowledgePanel';
import { EmbeddingPanel } from './settings/EmbeddingPanel';
import { MCPPanel } from './settings/MCPPanel';
import { AboutPanel } from './settings/AboutPanel';
import { useToast } from './Toast';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'appearance' | 'knowledge' | 'embedding' | 'mcp' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { theme, themeSetting, setThemeSetting, language, sidebarWidth, setSidebarWidth } = useSettings();
    const { showToast } = useToast();
    const STRINGS = getStrings(language);
    const modalRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
    const [config, setConfig] = useState<EmbeddingConfig>({
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
        apiKey: '',
        maxChunkSize: 512,
        overlap: 50,
    });
    const [status, setStatus] = useState<RAGStatus>({
        enabled: false,
        indexedDocs: 0,
        indexedBookmarks: 0,
        indexedFiles: 0,
        totalDocs: 0,
        lastIndexTime: '',
    });
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [rebuildProgress, setRebuildProgress] = useState<ReindexProgress | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [originalConfig, setOriginalConfig] = useState<EmbeddingConfig | null>(null);
    const [mcpInfo, setMcpInfo] = useState<MCPInfo>({ binaryPath: '', configJson: '' });

    // 加载配置和状态
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    // 订阅索引状态更新事件，实时刷新状态
    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = EventsOn('rag:status-updated', async () => {
            try {
                const statusData = await GetRAGStatus();
                setStatus(statusData);
            } catch (err) {
                console.error('Failed to refresh RAG status:', err);
            }
        });
        return () => unsubscribe();
    }, [isOpen]);

    const loadData = async () => {
        try {
            const [configData, statusData, mcpData] = await Promise.all([
                GetRAGConfig(),
                GetRAGStatus(),
                GetMCPInfo(),
            ]);
            setConfig(configData);
            setOriginalConfig(configData);
            setStatus(statusData);
            setMcpInfo(mcpData);
            setHasChanges(false);
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    };

    // 键盘事件处理
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // 配置变更检测
    const handleConfigChange = (field: keyof EmbeddingConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    // 保存配置
    const handleSave = async () => {
        setIsSaving(true);
        const modelChanged = originalConfig && originalConfig.model !== config.model;
        try {
            await SaveRAGConfig(config);
            setOriginalConfig(config);
            setHasChanges(false);

            // 如果模型变更，刷新状态（索引数会变成0）并切换到知识库面板提醒用户重建
            if (modelChanged) {
                const statusData = await GetRAGStatus();
                setStatus(statusData);
                setActiveTab('knowledge');
                // 显示模型变更提醒
                showToast(STRINGS.SETTINGS.MODEL_CHANGED, 'warning');
            }
        } catch (err) {
            console.error('Failed to save config:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // 重建索引
    const handleRebuild = async () => {
        setIsRebuilding(true);
        setRebuildProgress(null);

        // 订阅进度事件
        const unsubscribe = EventsOn('rag:reindex-progress', (progress: ReindexProgress) => {
            setRebuildProgress(progress);
        });

        try {
            await RebuildIndex();
            // 刷新状态
            const statusData = await GetRAGStatus();
            setStatus(statusData);
        } catch (err) {
            console.error('Failed to rebuild index:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            showToast(`Rebuild index failed: ${errorMessage}`, 'error');
        } finally {
            unsubscribe();
            setIsRebuilding(false);
            setRebuildProgress(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`settings-overlay ${theme}`} onClick={onClose}>
            <div
                ref={modalRef}
                className={`settings-modal ${theme}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
            >
                {/* 标题栏 */}
                <div className="settings-header">
                    <h2 id="settings-title">{STRINGS.SETTINGS.TITLE}</h2>
                    <button className="settings-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="settings-body">
                    {/* 侧边栏 */}
                    <nav className="settings-sidebar">
                        <button
                            className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <Palette size={18} />
                            <span>{STRINGS.SETTINGS.APPEARANCE}</span>
                        </button>
                        <button
                            className={`settings-nav-item ${activeTab === 'knowledge' ? 'active' : ''}`}
                            onClick={() => setActiveTab('knowledge')}
                        >
                            <Database size={18} />
                            <span>{STRINGS.SETTINGS.KNOWLEDGE_BASE}</span>
                        </button>
                        <button
                            className={`settings-nav-item ${activeTab === 'embedding' ? 'active' : ''}`}
                            onClick={() => setActiveTab('embedding')}
                        >
                            <Bot size={18} />
                            <span>{STRINGS.SETTINGS.EMBEDDING_MODEL}</span>
                        </button>
                        <button
                            className={`settings-nav-item ${activeTab === 'mcp' ? 'active' : ''}`}
                            onClick={() => setActiveTab('mcp')}
                        >
                            <Terminal size={18} />
                            <span>{STRINGS.MCP.TITLE}</span>
                        </button>
                        <button
                            className={`settings-nav-item ${activeTab === 'about' ? 'active' : ''}`}
                            onClick={() => setActiveTab('about')}
                        >
                            <Info size={18} />
                            <span>{STRINGS.ABOUT.TITLE}</span>
                        </button>
                    </nav>

                    {/* 主内容区域 (包含内容和底部按钮) */}
                    <div className="settings-main">
                        {/* 内容区 */}
                        <div className="settings-content">
                            {activeTab === 'appearance' && (
                                <AppearancePanel
                                    themeSetting={themeSetting}
                                    sidebarWidth={sidebarWidth}
                                    onThemeChange={setThemeSetting}
                                    onSidebarWidthChange={setSidebarWidth}
                                    strings={STRINGS}
                                />
                            )}
                            {activeTab === 'knowledge' && (
                                <KnowledgePanel
                                    status={status}
                                    isRebuilding={isRebuilding}
                                    progress={rebuildProgress}
                                    onRebuild={handleRebuild}
                                    strings={STRINGS}
                                />
                            )}
                            {activeTab === 'embedding' && (
                                <EmbeddingPanel
                                    config={config}
                                    onChange={handleConfigChange}
                                    strings={STRINGS}
                                />
                            )}
                            {activeTab === 'mcp' && (
                                <MCPPanel
                                    mcpInfo={mcpInfo}
                                    strings={STRINGS}
                                />
                            )}
                            {activeTab === 'about' && (
                                <AboutPanel
                                    strings={STRINGS}
                                />
                            )}
                        </div>

                        {/* 底部按钮 */}
                        <div className="settings-footer">
                            <button className="settings-btn cancel" onClick={onClose}>
                                {STRINGS.BUTTONS.CANCEL}
                            </button>
                            <button
                                className="settings-btn save"
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                            >
                                {isSaving ? STRINGS.SETTINGS.SAVING : STRINGS.BUTTONS.SAVE}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
