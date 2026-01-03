import React from 'react';
import { StringsType } from '../../constants/strings';
import { Github, Globe, FileText, Info } from 'lucide-react';
import './AboutPanel.css';

interface AboutPanelProps {
    strings: StringsType;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ strings }) => {
    return (
        <div className="settings-panel about-panel">
            <div className="settings-panel-header">
                <h3>{strings.ABOUT.TITLE}</h3>
            </div>

            <div className="settings-section about-content">
                <div className="app-logo-large">
                    {/* Placeholder for logo if we had one, using icon for now */}
                    <div className="logo-icon-placeholder">
                        <span className="logo-text">N</span>
                    </div>
                </div>

                <h1 className="app-name">{strings.ABOUT.APP_NAME}</h1>
                <div className="app-version">{strings.ABOUT.VERSION}</div>
                <p className="app-description">{strings.ABOUT.DESCRIPTION}</p>

                <div className="about-links">
                    <a href="https://github.com/7Sageer/nook" target="_blank" rel="noopener noreferrer" className="about-link">
                        <Github size={16} />
                        <span>{strings.ABOUT.LINKS.GITHUB}</span>
                    </a>
                </div>

                <div className="app-copyright">
                    {strings.ABOUT.COPYRIGHT}
                </div>
            </div>
        </div>
    );
};
