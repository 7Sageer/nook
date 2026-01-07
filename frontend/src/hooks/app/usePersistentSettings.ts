import { useState, useEffect, useCallback } from 'react';
import { GetSettings, SaveSettings } from '../../../wailsjs/go/main/App';
import { handlers } from '../../../wailsjs/go/models';

import { useDebounce } from '../ui/useDebounce';

export function usePersistentSettings() {
    const [storedSettings, setStoredSettings] = useState<handlers.Settings>({
        theme: '', // will be set on load
        language: '',
        sidebarWidth: 0,
        fontSize: 0,
        writingStyle: '',
    });
    const [isLoaded, setIsLoaded] = useState(false);

    // Debounce save operations (e.g. sidebar resizing)
    const debouncedSave = useDebounce((s: handlers.Settings) => {
        SaveSettings(s);
    }, 500);

    useEffect(() => {
        GetSettings().then((s) => {
            setStoredSettings(s);
            setIsLoaded(true);
        });
    }, []);

    const updateSettings = useCallback((partial: Partial<handlers.Settings>) => {
        setStoredSettings((prev: handlers.Settings) => {
            const next = { ...prev, ...partial };
            debouncedSave(next as handlers.Settings);
            return next;
        });
    }, [debouncedSave]);

    return { settings: storedSettings, updateSettings, isLoaded };
}
