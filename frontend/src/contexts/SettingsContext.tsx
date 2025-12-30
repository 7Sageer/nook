import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/handlers/SettingsHandler';

export type ThemeSetting = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type LanguageSetting = 'en' | 'zh';

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

interface SettingsContextType {
    theme: ResolvedTheme;
    themeSetting: ThemeSetting;
    language: LanguageSetting;
    sidebarWidth: number;
    toggleTheme: () => void;
    setThemeSetting: (theme: ThemeSetting) => void;
    setLanguage: (lang: LanguageSetting) => void;
    setSidebarWidth: (width: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

function getSystemLanguage(): LanguageSetting {
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [themeSetting, setThemeSettingState] = useState<ThemeSetting>('light');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
    const [language, setLanguageState] = useState<LanguageSetting>(getSystemLanguage());
    const [sidebarWidth, setSidebarWidthState] = useState<number>(DEFAULT_SIDEBAR_WIDTH);

    // Resolve theme based on setting and system preference
    useEffect(() => {
        if (themeSetting === 'system') {
            setResolvedTheme(getSystemTheme());
        } else {
            setResolvedTheme(themeSetting);
        }
    }, [themeSetting]);

    // Listen for system theme changes
    useEffect(() => {
        if (themeSetting !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            setResolvedTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [themeSetting]);

    // Apply sidebar width CSS variable
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
    }, [sidebarWidth]);

    // Load initial settings from backend
    useEffect(() => {
        GetSettings().then((settings) => {
            if (settings.theme) {
                setThemeSettingState(settings.theme as ThemeSetting);
            }
            if (settings.language) {
                setLanguageState(settings.language as LanguageSetting);
            }
            if (settings.sidebarWidth && settings.sidebarWidth > 0) {
                setSidebarWidthState(settings.sidebarWidth);
            }
        });
    }, []);

    const toggleTheme = () => {
        const nextTheme: ThemeSetting =
            themeSetting === 'light' ? 'dark' :
                themeSetting === 'dark' ? 'system' : 'light';
        setThemeSettingState(nextTheme);
        SaveSettings({ theme: nextTheme, language, sidebarWidth });
    };

    const setThemeSetting = (theme: ThemeSetting) => {
        setThemeSettingState(theme);
        SaveSettings({ theme, language, sidebarWidth });
    };

    const handleSetLanguage = (lang: LanguageSetting) => {
        setLanguageState(lang);
        SaveSettings({ theme: themeSetting, language: lang, sidebarWidth });
    };

    const handleSetSidebarWidth = (width: number) => {
        const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
        setSidebarWidthState(clampedWidth);
        SaveSettings({ theme: themeSetting, language, sidebarWidth: clampedWidth });
    };

    return (
        <SettingsContext.Provider value={{
            theme: resolvedTheme,
            themeSetting,
            language,
            sidebarWidth,
            toggleTheme,
            setThemeSetting,
            setLanguage: handleSetLanguage,
            setSidebarWidth: handleSetSidebarWidth
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
}

export { DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH };
