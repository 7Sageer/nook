import React, { useState } from 'react';
import { Copy, Check, Terminal, FileText, Search, Tag } from 'lucide-react';
import { getStrings } from '../../constants/strings';
import type { MCPInfo } from '../../types/settings';

interface MCPPanelProps {
    mcpInfo: MCPInfo;
    strings: ReturnType<typeof getStrings>;
}

export const MCPPanel: React.FC<MCPPanelProps> = ({ mcpInfo, strings }) => {
    const [copiedPath, setCopiedPath] = useState(false);
    const [copiedConfig, setCopiedConfig] = useState(false);

    const handleCopyPath = async () => {
        await navigator.clipboard.writeText(mcpInfo.binaryPath);
        setCopiedPath(true);
        setTimeout(() => setCopiedPath(false), 2000);
    };

    const handleCopyConfig = async () => {
        await navigator.clipboard.writeText(mcpInfo.configJson);
        setCopiedConfig(true);
        setTimeout(() => setCopiedConfig(false), 2000);
    };

    const featureIcons = [
        <Search size={14} key="search" />,
        <FileText size={14} key="file" />,
        <Terminal size={14} key="terminal" />,
        <Tag size={14} key="tag" />,
    ];

    return (
        <div className="settings-panel">
            <h3>{strings.MCP.TITLE}</h3>

            <div className="settings-form">
                {/* 描述 */}
                <p className="mcp-description">{strings.MCP.DESCRIPTION}</p>

                {/* 二进制路径 */}
                <div className="form-group">
                    <label>{strings.MCP.BINARY_PATH}</label>
                    <div className="mcp-path-container">
                        <code className="mcp-path">{mcpInfo.binaryPath}</code>
                        <button
                            className="mcp-copy-btn"
                            onClick={handleCopyPath}
                            title={strings.MCP.COPY_PATH}
                        >
                            {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>

                {/* 配置示例 */}
                <div className="form-group">
                    <label>{strings.MCP.CONFIG_EXAMPLE}</label>
                    <p className="mcp-hint">{strings.MCP.CONFIG_HINT}</p>
                    <div className="mcp-config-container">
                        <pre className="mcp-config">{mcpInfo.configJson}</pre>
                        <button
                            className="mcp-copy-btn"
                            onClick={handleCopyConfig}
                            title={strings.MCP.COPY_CONFIG}
                        >
                            {copiedConfig ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>

                {/* 功能列表 */}
                <div className="form-group">
                    <label>{strings.MCP.FEATURES}</label>
                    <ul className="mcp-features">
                        {strings.MCP.FEATURE_LIST.map((feature, index) => (
                            <li key={index}>
                                {featureIcons[index]}
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
