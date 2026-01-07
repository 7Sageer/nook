import { useWailsEvents } from './useWailsEvents';

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
    useWailsEvents(
        {
            'menu:new-document': onNewDocument,
            'menu:new-folder': onNewFolder,
            'menu:import': onImport,
            'menu:export': onExport,
            'menu:copy-image': onCopyImage,
            'menu:save-image': onSaveImage,
            'menu:export-html': onExportHTML,
            'menu:print': onPrint,
            'menu:toggle-sidebar': onToggleSidebar,
            'menu:toggle-theme': onToggleTheme,
            'menu:about': onAbout,
            'menu:open-external': onOpenExternal,
            'menu:settings': onSettings,
        },
        [onNewDocument, onNewFolder, onImport, onExport, onCopyImage, onSaveImage, onExportHTML, onPrint, onToggleSidebar, onToggleTheme, onAbout, onOpenExternal, onSettings]
    );
}
