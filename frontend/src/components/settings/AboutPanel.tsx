import React, { useState, useEffect } from 'react';
import { ExternalLink, Github, Heart } from 'lucide-react';
import { getStrings } from '../../constants/strings';
import { GetAppInfo, CheckForUpdates } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { main } from '../../../wailsjs/go/models';
import logoImage from '../../assets/images/logo-universal.png';
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

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
    const [checking, setChecking] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<main.UpdateInfo | null>(null);
    const [checkError, setCheckError] = useState<string | null>(null);

    useEffect(() => {
        GetAppInfo().then(setAppInfo).catch(console.error);
    }, []);

    const openLink = (url: string) => {
        BrowserOpenURL(url);
    };

    const handleCheckUpdate = async () => {
        setChecking(true);
        setUpdateInfo(null);
        setCheckError(null);
        try {
            const info = await CheckForUpdates();
            setUpdateInfo(info);
        } catch (err) {
            console.error(err);
            setCheckError('Failed to check for updates');
        } finally {
            setChecking(false);
        }
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
                    <div className="about-version-container">
                        <span className="about-version">{appInfo?.version || 'v1.0.0'}</span>
                        <button
                            className={`check-update-btn ${checking ? 'loading' : ''}`}
                            onClick={handleCheckUpdate}
                            disabled={checking}
                            title="Check for updates"
                        >
                            {checking ? <Loader2 className="animate-spin" size={14} /> : "Check for updates"}
                        </button>
                    </div>
                    {/* Update Result Display */}
                    {(updateInfo || checkError) && (
                        <div className={`update-status ${checkError ? 'error' : (updateInfo?.hasUpdate ? 'available' : 'latest')}`}>
                            {checkError ? (
                                <>
                                    <AlertCircle size={14} />
                                    <span>{checkError}</span>
                                </>
                            ) : updateInfo?.hasUpdate ? (
                                <div className="update-available-msg">
                                    <AlertCircle size={14} />
                                    <span>New version available: {updateInfo.latestVersion}</span>
                                    <button className="view-release-btn" onClick={() => openLink(updateInfo.releaseURL)}>
                                        View <ArrowRight size={12} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <CheckCircle size={14} />
                                    <span>You are using the latest version</span>
                                </>
                            )}
                        </div>
                    )}
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
                    <span className="about-info-value">AGPL-3.0 license</span>
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
