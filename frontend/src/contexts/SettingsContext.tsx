import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

export type ThemeSetting = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type LanguageSetting = 'en' | 'zh';

interface SettingsContextType {
    theme: ResolvedTheme;
    themeSetting: ThemeSetting;
    language: LanguageSetting;
    toggleTheme: () => void;
    setLanguage: (lang: LanguageSetting) => void;
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
    const [themeSetting, setThemeSetting] = useState<ThemeSetting>('light');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
    const [language, setLanguage] = useState<LanguageSetting>(getSystemLanguage());

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

    // Load initial settings from backend
    useEffect(() => {
        GetSettings().then((settings) => {
            if (settings.theme) {
                setThemeSetting(settings.theme as ThemeSetting);
            }
            if (settings.language) {
                setLanguage(settings.language as LanguageSetting);
            }
        });
    }, []);

    const toggleTheme = () => {
        const nextTheme: ThemeSetting =
            themeSetting === 'light' ? 'dark' :
                themeSetting === 'dark' ? 'system' : 'light';
        setThemeSetting(nextTheme);
        SaveSettings({ theme: nextTheme, language });
    };

    const handleSetLanguage = (lang: LanguageSetting) => {
        setLanguage(lang);
        SaveSettings({ theme: themeSetting, language: lang });
    };

    return (
        <SettingsContext.Provider value={{
            theme: resolvedTheme,
            themeSetting,
            language,
            toggleTheme,
            setLanguage: handleSetLanguage
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
