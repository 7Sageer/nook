import React from 'react';
import { ThemeSetting, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../../contexts/SettingsContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Slider } from '@mantine/core';
import { getStrings } from '../../constants/strings';

interface AppearancePanelProps {
    themeSetting: ThemeSetting;
    sidebarWidth: number;
    onThemeChange: (theme: ThemeSetting) => void;
    onSidebarWidthChange: (width: number) => void;
    strings: ReturnType<typeof getStrings>;
}

export const AppearancePanel: React.FC<AppearancePanelProps> = ({
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
                    <Slider
                        min={MIN_SIDEBAR_WIDTH}
                        max={MAX_SIDEBAR_WIDTH}
                        step={25}
                        value={sidebarWidth}
                        onChange={onSidebarWidthChange}
                        marks={[
                            { value: MIN_SIDEBAR_WIDTH, label: `${MIN_SIDEBAR_WIDTH}px` },
                            { value: (MIN_SIDEBAR_WIDTH + MAX_SIDEBAR_WIDTH) / 2, label: `${(MIN_SIDEBAR_WIDTH + MAX_SIDEBAR_WIDTH) / 2}px` },
                            { value: MAX_SIDEBAR_WIDTH, label: `${MAX_SIDEBAR_WIDTH}px` },
                        ]}
                        styles={{
                            track: { backgroundColor: 'var(--border-primary)' },
                            bar: { backgroundColor: 'var(--primary)' },
                            thumb: {
                                backgroundColor: 'var(--primary)',
                                borderColor: 'var(--bg-modal)',
                            },
                            markLabel: {
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
