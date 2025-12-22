import { useEffect } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface MenuEventsOptions {
    onNewDocument: () => void;
    onNewFolder?: () => void;
    onImport: () => void;
    onExport: () => void;
    onExportImage?: () => void;
    onExportHTML?: () => void;
    onPrint?: () => void;
    onToggleSidebar: () => void;
    onToggleTheme: () => void;
    onAbout: () => void;
    onOpenExternal?: () => void;
}

export function useMenuEvents({
    onNewDocument,
    onNewFolder,
    onImport,
    onExport,
    onExportImage,
    onExportHTML,
    onPrint,
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

        if (onNewFolder) {
            unsubscribers.push(EventsOn('menu:new-folder', onNewFolder));
        }

        if (onOpenExternal) {
            unsubscribers.push(EventsOn('menu:open-external', onOpenExternal));
        }

        if (onExportImage) {
            unsubscribers.push(EventsOn('menu:export-image', onExportImage));
        }

        if (onExportHTML) {
            unsubscribers.push(EventsOn('menu:export-html', onExportHTML));
        }

        if (onPrint) {
            unsubscribers.push(EventsOn('menu:print', onPrint));
        }

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [onNewDocument, onNewFolder, onImport, onExport, onExportImage, onExportHTML, onPrint, onToggleSidebar, onToggleTheme, onAbout, onOpenExternal]);
}

