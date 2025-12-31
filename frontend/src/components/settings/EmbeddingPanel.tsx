import React from 'react';
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
