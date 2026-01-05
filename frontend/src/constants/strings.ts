// DnD constants
export const DND_CONSTANTS = {
    UNCATEGORIZED_CONTAINER_ID: '__uncategorized__',
    DOC_CONTAINER_PREFIX: 'doc-container:',
    DOC_CONTAINER_HEADER_PREFIX: 'doc-container-header:',
    DOC_CONTAINER_LIST_PREFIX: 'doc-container-list:',
    PINNED_TAG_PREFIX: 'pinned-tag:',
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
        NEW_PINNED_TAG: "New Tag",
    },

    TOOLTIPS: {
        NEW_DOC: "New Document",
        NEW_PINNED_TAG: "New Pinned Tag",
        REORDER_PINNED_TAGS: "Reorder pinned tags",
        REORDER_PINNED_TAGS_DONE: "Done reordering pinned tags",
        PINNED_TAG_DRAG: "Drag to reorder pinned tags",
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
        PINNED_TAG_RENAME: "Rename Tag",
        PINNED_TAG_DELETE: "Delete Tag",
        PINNED_TAG_ADD_DOC: "Add Document",
        PIN_TAG: "Pin to Sidebar",
        UNPIN_TAG: "Unpin from Sidebar",
    },

    LABELS: {
        SIDEBAR: "Sidebar Navigation",
        EXTERNAL_FILE: "External File",
        BOOKMARK: "Bookmark",
        FILE: "File",
        FILE_SUBTEXT: "Embed MD, TXT file",
        FOLDER: "Folder",
        FOLDER_SUBTEXT: "Index a folder for RAG",
        DOCUMENTS: "Documents",
        PINNED_TAGS: "Pinned Tags",
        UNCATEGORIZED: "Uncategorized",
        SEARCH_PLACEHOLDER: "Search documents...",
        NO_MATCH: "No matching documents found",
        EMPTY_LIST: "No documents yet, click + to create",
        EMPTY_APP: "No documents yet",
    },

    MODALS: {
        DELETE_TITLE: "Delete Document",
        DELETE_MESSAGE: "Are you sure you want to delete this document? This action cannot be undone.",
        DELETE_TAG_TITLE: "Delete Tag",
        DELETE_TAG_MESSAGE: "Are you sure you want to delete this tag? The tag will be removed from all documents.",
        RENAME_TAG_TITLE: "Rename Tag",
    },

    MENU: {
        NEW_DOC: "New Document",
        NEW_PINNED_TAG: "New Pinned Tag",
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
        INDEXED_FILES: "Indexed Files",
        INDEXED_FOLDERS: "Indexed Folders",
        DOCUMENTS: "documents",
        LAST_UPDATE: "Last Update",
        REBUILD_INDEX: "Rebuild Index",
        REBUILDING: "Rebuilding...",
        INDEXING_DOCUMENTS: "Indexing documents",
        INDEXING_EXTERNAL: "Indexing external content",
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
        WRITING_STYLE: "Writing Style Guide",
        WRITING_STYLE_PLACEHOLDER: "Define your writing preferences here (e.g., language, format, tone)...",
        WRITING_STYLE_HINT: "This guide will be used by AI assistants (like Claude Code MCP) when creating or editing content.",
    },

    MCP: {
        TITLE: "MCP Integration",
        DESCRIPTION: "Nook provides an MCP (Model Context Protocol) server that allows AI assistants like Claude Code to access your notes.",
        BINARY_PATH: "MCP Binary Path",
        CONFIG_EXAMPLE: "Claude Code Configuration",
        CONFIG_HINT: "Add the following to your Claude Code settings (~/.claude.json or project .mcp.json):",
        COPY_PATH: "Copy Path",
        COPY_CONFIG: "Copy Config",
        COPIED: "Copied!",
        FEATURES: "Features",
        FEATURE_LIST: [
            "Search and read your documents",
            "Create and update notes",
            "Semantic search with RAG",
            "Manage tags and organization",
        ],
    },

    ABOUT: {
        TITLE: "About",
        APP_NAME: "Nook",
        DESCRIPTION: "Write. Gather. Connect.\nNook is a local-first knowledge base that gathers your notes and files into one semantic memory for your AI.",
        AUTHOR: "Author",
        LICENSE: "License",
        COPYRIGHT: "Copyright",
        FEEDBACK: "Feedback",
        BUILT_WITH: "Built with ❤️ using Wails, React & Go",
    },
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
