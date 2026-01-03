import React, { useState, useEffect } from 'react';
import { ExternalLink, Github, Heart } from 'lucide-react';
import { getStrings } from '../../constants/strings';
import { GetAppInfo } from '../../../wailsjs/go/main/App';
import logoImage from '../../assets/images/logo-universal.png';

interface AboutPanelProps {
    strings: ReturnType<typeof getStrings>;
}

interface AppInfo {
    name: string;
    version: string;
    author: string;
    copyright: string;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ strings }) => {
    const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

    useEffect(() => {
        GetAppInfo().then(setAppInfo).catch(console.error);
    }, []);

    const openLink = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="settings-panel about-panel">
            {/* App Logo and Name */}
            <div className="about-header">
                <div className="about-logo">
                    <img src={logoImage} alt="Nook Logo" />
                </div>
                <div className="about-title">
                    <h2>{appInfo?.name || strings.ABOUT.APP_NAME}</h2>
                    <span className="about-version">v{appInfo?.version || '1.0.0'}</span>
                </div>
            </div>

            {/* App Description */}
            <p className="about-description">{strings.ABOUT.DESCRIPTION}</p>

            {/* Info Card */}
            <div className="about-info-card">
                <div className="about-info-row">
                    <span className="about-info-label">{strings.ABOUT.AUTHOR}</span>
                    <span className="about-info-value">{appInfo?.author || '7Sageer'}</span>
                </div>
                <div className="about-info-row">
                    <span className="about-info-label">{strings.ABOUT.LICENSE}</span>
                    <span className="about-info-value">MIT License</span>
                </div>
                <div className="about-info-row">
                    <span className="about-info-label">{strings.ABOUT.COPYRIGHT}</span>
                    <span className="about-info-value">{appInfo?.copyright || '© 2024-2026 7Sageer'}</span>
                </div>
            </div>

            {/* Links */}
            <div className="about-links">
                <button
                    className="about-link-btn"
                    onClick={() => openLink('https://github.com/7Sageer/nook')}
                >
                    <Github size={16} />
                    <span>GitHub</span>
                    <ExternalLink size={12} />
                </button>
                <button
                    className="about-link-btn"
                    onClick={() => openLink('https://github.com/7Sageer/nook/issues')}
                >
                    <Heart size={16} />
                    <span>{strings.ABOUT.FEEDBACK}</span>
                    <ExternalLink size={12} />
                </button>
            </div>

            {/* Credits */}
            <div className="about-credits">
                <span>{strings.ABOUT.BUILT_WITH}</span>
            </div>
        </div>
    );
};
