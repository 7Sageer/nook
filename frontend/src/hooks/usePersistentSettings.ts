import { useState, useEffect, useCallback } from 'react';
import { GetSettings, SaveSettings } from '../../wailsjs/go/main/App';
import { settings } from '../../wailsjs/go/models';

import { useDebounce } from './useDebounce';

export function usePersistentSettings() {
    const [storedSettings, setStoredSettings] = useState<settings.Settings>({
        theme: '', // will be set on load
        language: '',
        sidebarWidth: 0,
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Debounce save operations (e.g. sidebar resizing)
    const debouncedSave = useDebounce((s: settings.Settings) => {
        SaveSettings(s);
    }, 500);

    useEffect(() => {
        GetSettings().then((s) => {
            setStoredSettings(s);
            setIsLoaded(true);
        });
    }, []);

    const updateSettings = useCallback((partial: Partial<settings.Settings>) => {
        setStoredSettings((prev) => {
            const next = { ...prev, ...partial };
            debouncedSave(next as settings.Settings);
            return next;
        });
    }, [debouncedSave]);

    return { settings: storedSettings, updateSettings, isLoaded };
}
