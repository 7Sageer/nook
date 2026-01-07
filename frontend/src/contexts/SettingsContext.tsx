import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePersistentSettings } from '../hooks/app/usePersistentSettings';

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
    writingStyle: string;
    toggleTheme: () => void;
    setThemeSetting: (theme: ThemeSetting) => void;
    setLanguage: (lang: LanguageSetting) => void;
    setSidebarWidth: (width: number) => void;
    setWritingStyle: (style: string) => void;
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
    const { settings, updateSettings, isLoaded } = usePersistentSettings();

    // Local derived state for resolved theme (visual only)
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

    // Mapped state from persistent settings
    // Default to 'light' / system lang if not loaded or empty
    const themeSetting = (settings.theme as ThemeSetting) || 'light';
    const language = (settings.language as LanguageSetting) || getSystemLanguage();
    const sidebarWidth = (settings.sidebarWidth > 0) ? settings.sidebarWidth : DEFAULT_SIDEBAR_WIDTH;
    const writingStyle = settings.writingStyle || '';

    // Resolve theme based on setting and system preference
    useEffect(() => {
        if (themeSetting === 'system') {
            setResolvedTheme(getSystemTheme());
        } else {
            setResolvedTheme(themeSetting as ResolvedTheme);
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

    // Sync theme to body for portal elements (dropdowns, modals, etc.)
    useEffect(() => {
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(resolvedTheme);
    }, [resolvedTheme]);

    const toggleTheme = () => {
        const nextTheme: ThemeSetting =
            themeSetting === 'light' ? 'dark' :
                themeSetting === 'dark' ? 'system' : 'light';
        updateSettings({ theme: nextTheme });
    };

    const setThemeSetting = (theme: ThemeSetting) => {
        updateSettings({ theme });
    };

    const handleSetLanguage = (lang: LanguageSetting) => {
        updateSettings({ language: lang });
    };

    const handleSetSidebarWidth = (width: number) => {
        const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
        updateSettings({ sidebarWidth: clampedWidth });
    };

    const handleSetWritingStyle = (style: string) => {
        updateSettings({ writingStyle: style });
    };

    if (!isLoaded) {
        return null; // or a loading spinner? returning null prevents flashing default styles incorrectly
    }

    return (
        <SettingsContext.Provider value={{
            theme: resolvedTheme,
            themeSetting,
            language,
            sidebarWidth,
            writingStyle,
            toggleTheme,
            setThemeSetting,
            setLanguage: handleSetLanguage,
            setSidebarWidth: handleSetSidebarWidth,
            setWritingStyle: handleSetWritingStyle
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
