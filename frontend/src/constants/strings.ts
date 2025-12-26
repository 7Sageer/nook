export const EN = {
    APP_NAME: "Nook",
    ABOUT_INFO: "Nook v1.0.0\n\nA simple and elegant local note-taking application",

    STATUS: {
        LOADING: "Loading...",
        SAVING: "Saving...",
        SAVED: "Saved",
        IMAGE_COPIED: "Image copied",
        HTML_EXPORTED: "HTML exported",
        EXPORT_IMAGE_FAILED: "Export image failed:",
    },

    BUTTONS: {
        CONFIRM: "Confirm",
        CANCEL: "Cancel",
        CREATE_DOC: "Create New Document",
    },

    DEFAULTS: {
        UNTITLED: "Untitled",
        NEW_FOLDER: "New Folder",
    },

    TOOLTIPS: {
        NEW_DOC: "New Document",
        NEW_FOLDER: "New Folder",
        OPEN_FILE: "Open File",
        IMPORT: "Import Markdown",
        EXPORT: "Export Markdown",
        EXPORT_IMAGE: "Export as Image to Clipboard",
        EXPORT_HTML: "Export as HTML File",
        PRINT: "Print / Save as PDF",
        THEME_LIGHT: "Light Mode (click to switch)",
        THEME_DARK: "Dark Mode (click to switch)",
        THEME_SYSTEM: "Follow System (click to switch)",
        COLLAPSE: "Collapse Sidebar",
        EXPAND: "Expand Sidebar",
        CLOSE_EXTERNAL: "Close External File",
        DELETE: "Delete",
        FOLDER_RENAME: "Rename Folder",
        FOLDER_DELETE: "Delete Folder",
        FOLDER_ADD_DOC: "Add Document to Folder",
    },

    LABELS: {
        SIDEBAR: "Sidebar Navigation",
        EXTERNAL_FILE: "External File",
        DOCUMENTS: "Documents",
        FOLDERS: "Folders",
        UNCATEGORIZED: "Uncategorized",
        SEARCH_PLACEHOLDER: "Search documents...",
        NO_MATCH: "No matching documents found",
        EMPTY_LIST: "No documents yet, click + to create",
        EMPTY_APP: "No documents yet",
        DEFAULT_FOLDER_NAME: "New Folder",
    },

    MODALS: {
        DELETE_TITLE: "Delete Document",
        DELETE_MESSAGE: "Are you sure you want to delete this document? This action cannot be undone.",
        DELETE_FOLDER_TITLE: "Delete Folder",
        DELETE_FOLDER_MESSAGE: "Are you sure you want to delete this folder? Documents inside will be moved to uncategorized.",
    },

    MENU: {
        NEW_DOC: "New Document",
        NEW_FOLDER: "New Folder",
    }
};



export type StringsType = typeof EN;

// Always return English
export function getStrings(lang: string): StringsType {
    // Avoid unused variable warning if strict
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = lang;
    return EN;
}

// Force English as default
const initialLang = 'en';
export const STRINGS = getStrings(initialLang);
