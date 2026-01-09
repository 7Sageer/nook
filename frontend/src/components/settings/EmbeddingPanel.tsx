import React, { useState, useCallback } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { ListModels, TestConnection } from '../../../wailsjs/go/main/App';
import { getStrings } from '../../constants/strings';
import type { EmbeddingConfig } from '../../types/settings';

interface EmbeddingPanelProps {
    config: EmbeddingConfig;
    onChange: (field: keyof EmbeddingConfig, value: string) => void;
    strings: ReturnType<typeof getStrings>;
}

export const EmbeddingPanel: React.FC<EmbeddingPanelProps> = ({
    config,
    onChange,
    strings,
}) => {
    const [models, setModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [useManualInput, setUseManualInput] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; dimension?: number; error?: string } | null>(null);

    const handleFetchModels = useCallback(async () => {
        setIsLoadingModels(true);
        setFetchError(null);
        try {
            const modelList = await ListModels(config.provider, config.baseUrl, config.apiKey);
            setModels(modelList || []);
            if (modelList && modelList.length === 0) {
                setFetchError(strings.SETTINGS.NO_MODELS_FOUND);
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
            setFetchError(strings.SETTINGS.FETCH_MODELS_FAILED);
            setModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    }, [config.provider, config.baseUrl, config.apiKey, strings]);

    const handleModelChange = (value: string) => {
        if (value === '__manual__') {
            setUseManualInput(true);
            return;
        }
        onChange('model', value);
    };

    const handleTestConnection = useCallback(async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await TestConnection(config);
            setTestResult(result);
        } catch (err) {
            setTestResult({ success: false, error: String(err) });
        } finally {
            setIsTesting(false);
        }
    }, [config]);

    return (
        <div className="settings-panel">
            <h3>{strings.SETTINGS.EMBEDDING_MODEL}</h3>

            <div className="settings-form">
                <div className="form-group">
                    <label>{strings.SETTINGS.PROVIDER}</label>
                    <select
                        value={config.provider}
                        onChange={(e) => {
                            onChange('provider', e.target.value);
                            setModels([]);
                            setFetchError(null);
                            setUseManualInput(false);
                        }}
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
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <div className="form-group">
                    <label>{strings.SETTINGS.API_KEY}</label>
                    <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => onChange('apiKey', e.target.value)}
                        placeholder={strings.SETTINGS.API_KEY_PLACEHOLDER}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <div className="form-group">
                    <label>{strings.SETTINGS.MODEL}</label>
                    <div className="model-select-wrapper">
                        {useManualInput || models.length === 0 ? (
                            <input
                                type="text"
                                value={config.model}
                                onChange={(e) => onChange('model', e.target.value)}
                                placeholder="nomic-embed-text"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        ) : (
                            <select
                                value={config.model}
                                onChange={(e) => handleModelChange(e.target.value)}
                            >
                                {!models.includes(config.model) && config.model && (
                                    <option value={config.model}>{config.model}</option>
                                )}
                                {models.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                                <option value="__manual__">── {strings.SETTINGS.MANUAL_INPUT} ──</option>
                            </select>
                        )}
                        <button
                            type="button"
                            className="refresh-models-btn"
                            onClick={handleFetchModels}
                            disabled={isLoadingModels}
                            title={strings.SETTINGS.REFRESH_MODELS}
                        >
                            <RefreshCw size={16} className={isLoadingModels ? 'spinning' : ''} />
                        </button>
                        <button
                            type="button"
                            className={`test-connection-btn ${testResult?.success ? 'success' : testResult?.error ? 'error' : ''}`}
                            onClick={handleTestConnection}
                            disabled={isTesting || !config.model}
                            title={strings.SETTINGS.TEST_CONNECTION}
                        >
                            <Zap size={16} className={isTesting ? 'spinning' : ''} />
                        </button>
                    </div>
                    {fetchError && (
                        <span className="model-error">{fetchError}</span>
                    )}
                    {isLoadingModels && (
                        <span className="model-loading">{strings.SETTINGS.LOADING_MODELS}</span>
                    )}
                    {testResult && (
                        <span className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success 
                                ? `${strings.SETTINGS.CONNECTION_SUCCESS} (dim: ${testResult.dimension})`
                                : `${strings.SETTINGS.CONNECTION_FAILED}: ${testResult.error}`
                            }
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
