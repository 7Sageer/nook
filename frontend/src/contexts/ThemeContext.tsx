import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';

type ThemeSetting = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ResolvedTheme;
  themeSetting: ThemeSetting;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Resolve theme based on setting and system preference
  useEffect(() => {
    if (themeSetting === 'system') {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(themeSetting);
    }
  }, [themeSetting]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (themeSetting !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSetting]);

  // Load initial theme from settings
  useEffect(() => {
    GetSettings().then((settings) => {
      const savedTheme = settings.theme as ThemeSetting;
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
        setThemeSetting(savedTheme);
      } else {
        setThemeSetting('light');
      }
    });
  }, []);

  const toggleTheme = () => {
    // Cycle: light → dark → system → light
    const nextTheme: ThemeSetting =
      themeSetting === 'light' ? 'dark' :
        themeSetting === 'dark' ? 'system' : 'light';
    setThemeSetting(nextTheme);
    SaveSettings({ theme: nextTheme });
  };

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, themeSetting, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
