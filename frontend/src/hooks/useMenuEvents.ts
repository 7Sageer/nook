import { useEffect } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface MenuEventsOptions {
    onNewDocument: () => void;
    onNewFolder?: () => void;
    onImport: () => void;
    onExport: () => void;
    onCopyImage?: () => void;
    onSaveImage?: () => void;
    onExportHTML?: () => void;
    onPrint?: () => void;
    onToggleSidebar: () => void;
    onToggleTheme?: () => void;
    onAbout: () => void;
    onOpenExternal?: () => void;
    onSettings?: () => void;
}

export function useMenuEvents({
    onNewDocument,
    onNewFolder,
    onImport,
    onExport,
    onCopyImage,
    onSaveImage,
    onExportHTML,
    onPrint,
    onToggleSidebar,
    onToggleTheme,
    onAbout,
    onOpenExternal,
    onSettings,
}: MenuEventsOptions) {
    useEffect(() => {
        const unsubscribers = [
            EventsOn('menu:new-document', onNewDocument),
            EventsOn('menu:import', onImport),
            EventsOn('menu:export', onExport),
            EventsOn('menu:toggle-sidebar', onToggleSidebar),
            EventsOn('menu:about', onAbout),
        ];

        if (onNewFolder) {
            unsubscribers.push(EventsOn('menu:new-folder', onNewFolder));
        }

        if (onOpenExternal) {
            unsubscribers.push(EventsOn('menu:open-external', onOpenExternal));
        }

        if (onCopyImage) {
            unsubscribers.push(EventsOn('menu:copy-image', onCopyImage));
        }

        if (onSaveImage) {
            unsubscribers.push(EventsOn('menu:save-image', onSaveImage));
        }

        if (onExportHTML) {
            unsubscribers.push(EventsOn('menu:export-html', onExportHTML));
        }

        if (onPrint) {
            unsubscribers.push(EventsOn('menu:print', onPrint));
        }

        if (onSettings) {
            unsubscribers.push(EventsOn('menu:settings', onSettings));
        }

        if (onToggleTheme) {
            unsubscribers.push(EventsOn('menu:toggle-theme', onToggleTheme));
        }

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [onNewDocument, onNewFolder, onImport, onExport, onCopyImage, onSaveImage, onExportHTML, onPrint, onToggleSidebar, onToggleTheme, onAbout, onOpenExternal, onSettings]);
}
