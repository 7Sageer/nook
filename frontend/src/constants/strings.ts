// DnD constants
export const DND_CONSTANTS = {
    UNCATEGORIZED_CONTAINER_ID: '__uncategorized__',
    DOC_CONTAINER_PREFIX: 'doc-container:',
} as const;

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
        SAVE: "Save",
    },

    DEFAULTS: {
        UNTITLED: "Untitled",
        NEW_GROUP: "New Group",
    },

    TOOLTIPS: {
        NEW_DOC: "New Document",
        NEW_GROUP: "New Tag Group",
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
        GROUP_RENAME: "Rename Group",
        GROUP_DELETE: "Delete Group",
        GROUP_ADD_DOC: "Add Document to Group",
    },

    LABELS: {
        SIDEBAR: "Sidebar Navigation",
        EXTERNAL_FILE: "External File",
        BOOKMARK: "Bookmark",
        FILE: "File",
        FILE_SUBTEXT: "Embed MD, TXT file",
        DOCUMENTS: "Documents",
        GROUPS: "Groups",
        UNCATEGORIZED: "Uncategorized",
        SEARCH_PLACEHOLDER: "Search documents...",
        NO_MATCH: "No matching documents found",
        EMPTY_LIST: "No documents yet, click + to create",
        EMPTY_APP: "No documents yet",
        DEFAULT_GROUP_NAME: "New Group",
    },

    MODALS: {
        DELETE_TITLE: "Delete Document",
        DELETE_MESSAGE: "Are you sure you want to delete this document? This action cannot be undone.",
        DELETE_GROUP_TITLE: "Delete Group",
        DELETE_GROUP_MESSAGE: "Are you sure you want to delete this group? The tag will be removed from all documents.",
    },

    MENU: {
        NEW_DOC: "New Document",
        NEW_GROUP: "New Group",
    },

    PASTE_LINK: {
        AS_LINK: "Paste as link",
        AS_BOOKMARK: "Create bookmark",
    },

    SETTINGS: {
        TITLE: "Settings",
        KNOWLEDGE_BASE: "Knowledge Base",
        EMBEDDING_MODEL: "Embedding Model",
        INDEX_STATUS: "Index Status",
        INDEXED_BOOKMARKS: "Indexed Bookmarks",
        DOCUMENTS: "documents",
        LAST_UPDATE: "Last Update",
        REBUILD_INDEX: "Rebuild Index",
        REBUILDING: "Rebuilding...",
        SAVING: "Saving...",
        PROVIDER: "Provider",
        BASE_URL: "Base URL",
        MODEL: "Model",
        API_KEY: "API Key",
        API_KEY_PLACEHOLDER: "Required for OpenAI",
        MODEL_CHANGED: "Model changed. Please rebuild the index for semantic search to work correctly.",
        // Appearance settings
        APPEARANCE: "Appearance",
        THEME_SETTING: "Theme",
        THEME_LIGHT: "Light",
        THEME_DARK: "Dark",
        THEME_SYSTEM: "Follow System",
        SIDEBAR_WIDTH: "Sidebar Width",
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
