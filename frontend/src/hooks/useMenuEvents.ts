import { useEffect } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface MenuEventsOptions {
    onNewDocument: () => void;
    onImport: () => void;
    onExport: () => void;
    onToggleSidebar: () => void;
    onToggleTheme: () => void;
    onAbout: () => void;
    onOpenExternal?: () => void;
}

export function useMenuEvents({
    onNewDocument,
    onImport,
    onExport,
    onToggleSidebar,
    onToggleTheme,
    onAbout,
    onOpenExternal,
}: MenuEventsOptions) {
    useEffect(() => {
        const unsubscribers = [
            EventsOn('menu:new-document', onNewDocument),
            EventsOn('menu:import', onImport),
            EventsOn('menu:export', onExport),
            EventsOn('menu:toggle-sidebar', onToggleSidebar),
            EventsOn('menu:toggle-theme', onToggleTheme),
            EventsOn('menu:about', onAbout),
        ];

        if (onOpenExternal) {
            unsubscribers.push(EventsOn('menu:open-external', onOpenExternal));
        }

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [onNewDocument, onImport, onExport, onToggleSidebar, onToggleTheme, onAbout, onOpenExternal]);
}
