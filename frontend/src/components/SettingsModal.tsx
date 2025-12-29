import React, { useState, useEffect, useRef } from 'react';
import { useSettings, ThemeSetting, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../contexts/SettingsContext';
import { X, Database, Bot, RefreshCw, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { GetRAGConfig, SaveRAGConfig, GetRAGStatus, RebuildIndex } from '../../wailsjs/go/main/App';
import { getStrings } from '../constants/strings';
import './SettingsModal.css';

// 外观面板
interface AppearancePanelProps {
    themeSetting: ThemeSetting;
    sidebarWidth: number;
    onThemeChange: (theme: ThemeSetting) => void;
    onSidebarWidthChange: (width: number) => void;
    strings: ReturnType<typeof getStrings>;
}

const AppearancePanel: React.FC<AppearancePanelProps> = ({
    themeSetting,
    sidebarWidth,
    onThemeChange,
    onSidebarWidthChange,
    strings,
}) => {
    const themeOptions: { value: ThemeSetting; label: string; icon: React.ReactNode }[] = [
        { value: 'light', label: strings.SETTINGS.THEME_LIGHT, icon: <Sun size={16} /> },
        { value: 'dark', label: strings.SETTINGS.THEME_DARK, icon: <Moon size={16} /> },
        { value: 'system', label: strings.SETTINGS.THEME_SYSTEM, icon: <Monitor size={16} /> },
    ];

    return (
        <div className="settings-panel">
            <h3>{strings.SETTINGS.APPEARANCE}</h3>

            {/* 主题切换 */}
            <div className="settings-form">
                <div className="form-group">
                    <label>{strings.SETTINGS.THEME_SETTING}</label>
                    <div className="theme-options">
                        {themeOptions.map((option) => (
                            <button
                                key={option.value}
                                className={`theme-option ${themeSetting === option.value ? 'active' : ''}`}
                                onClick={() => onThemeChange(option.value)}
                            >
                                {option.icon}
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 侧边栏宽度滑块 */}
                <div className="form-group">
                    <label>{strings.SETTINGS.SIDEBAR_WIDTH}: {sidebarWidth}px</label>
                    <input
                        type="range"
                        min={MIN_SIDEBAR_WIDTH}
                        max={MAX_SIDEBAR_WIDTH}
                        step={25}
                        value={sidebarWidth}
                        onChange={(e) => onSidebarWidthChange(parseInt(e.target.value, 10))}
                        className="sidebar-width-slider-default"
                    />
                    <div className="slider-labels">
                        <span>{MIN_SIDEBAR_WIDTH}px</span>
                        <span>{(MIN_SIDEBAR_WIDTH + MAX_SIDEBAR_WIDTH) / 2}px</span>
                        <span>{MAX_SIDEBAR_WIDTH}px</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 知识库面板
interface KnowledgePanelProps {
    status: RAGStatus;
    isRebuilding: boolean;
    onRebuild: () => void;
    strings: ReturnType<typeof getStrings>;
}

const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
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

// 嵌入模型面板
interface EmbeddingPanelProps {
    config: EmbeddingConfig;
    onChange: (field: keyof EmbeddingConfig, value: string) => void;
    strings: ReturnType<typeof getStrings>;
}

const EmbeddingPanel: React.FC<EmbeddingPanelProps> = ({
    config,
    onChange,
    strings,
}) => (
    <div className="settings-panel">
        <h3>{strings.SETTINGS.EMBEDDING_MODEL}</h3>

        <div className="settings-form">
            <div className="form-group">
                <label>{strings.SETTINGS.PROVIDER}</label>
                <select
                    value={config.provider}
                    onChange={(e) => onChange('provider', e.target.value)}
                >
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI</option>
                </select>
            </div>

            <div className="form-group">
                <label>{strings.SETTINGS.BASE_URL}</label>
                <input
                    type="text"
                    value={config.baseUrl}
                    onChange={(e) => onChange('baseUrl', e.target.value)}
                    placeholder="http://localhost:11434"
                />
            </div>

            <div className="form-group">
                <label>{strings.SETTINGS.MODEL}</label>
                <input
                    type="text"
                    value={config.model}
                    onChange={(e) => onChange('model', e.target.value)}
                    placeholder="nomic-embed-text"
                />
            </div>

            <div className="form-group">
                <label>{strings.SETTINGS.API_KEY}</label>
                <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => onChange('apiKey', e.target.value)}
                    placeholder={strings.SETTINGS.API_KEY_PLACEHOLDER}
                />
            </div>
        </div>
    </div>
);

interface EmbeddingConfig {
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
}

interface RAGStatus {
    enabled: boolean;
    indexedDocs: number;
    totalDocs: number;
    lastIndexTime: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'appearance' | 'knowledge' | 'embedding';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { theme, themeSetting, setThemeSetting, language, sidebarWidth, setSidebarWidth } = useSettings();
    const STRINGS = getStrings(language);
    const modalRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
    const [config, setConfig] = useState<EmbeddingConfig>({
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
        apiKey: '',
    });
    const [status, setStatus] = useState<RAGStatus>({
        enabled: false,
        indexedDocs: 0,
        totalDocs: 0,
        lastIndexTime: '',
    });
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [originalConfig, setOriginalConfig] = useState<EmbeddingConfig | null>(null);

    // 加载配置和状态
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        try {
            const [configData, statusData] = await Promise.all([
                GetRAGConfig(),
                GetRAGStatus(),
            ]);
            setConfig(configData);
            setOriginalConfig(configData);
            setStatus(statusData);
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
                // 显示提醒（使用简单的 alert，可后续优化为 toast）
                alert(STRINGS.SETTINGS.MODEL_CHANGED);
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
        try {
            await RebuildIndex();
            // 刷新状态
            const statusData = await GetRAGStatus();
            setStatus(statusData);
        } catch (err) {
            console.error('Failed to rebuild index:', err);
        } finally {
            setIsRebuilding(false);
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
                    </nav>

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
                    </div>
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
    );
};
