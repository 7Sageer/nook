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

export const ZH = {
    APP_NAME: "Nook",
    ABOUT_INFO: "Nook v1.0.0\n\n一款简单优雅的本地笔记应用",

    STATUS: {
        LOADING: "加载中...",
        SAVING: "保存中...",
        SAVED: "已保存",
        IMAGE_COPIED: "图片已复制",
        HTML_EXPORTED: "HTML 已导出",
        EXPORT_IMAGE_FAILED: "导出图片失败:",
    },

    BUTTONS: {
        CONFIRM: "确定",
        CANCEL: "取消",
        CREATE_DOC: "创建新文档",
    },

    DEFAULTS: {
        UNTITLED: "无标题",
        NEW_FOLDER: "新建文件夹",
    },

    TOOLTIPS: {
        NEW_DOC: "新建文档",
        NEW_FOLDER: "新建文件夹",
        OPEN_FILE: "打开文件",
        IMPORT: "导入 Markdown",
        EXPORT: "导出 Markdown",
        EXPORT_IMAGE: "导出图片到剪贴板",
        EXPORT_HTML: "导出为 HTML 文件",
        PRINT: "打印 / 保存为 PDF",
        THEME_LIGHT: "浅色模式 (点击切换)",
        THEME_DARK: "深色模式 (点击切换)",
        THEME_SYSTEM: "跟随系统 (点击切换)",
        COLLAPSE: "收起侧边栏",
        EXPAND: "展开侧边栏",
        CLOSE_EXTERNAL: "关闭外部文件",
        DELETE: "删除",
        FOLDER_RENAME: "重命名文件夹",
        FOLDER_DELETE: "删除文件夹",
        FOLDER_ADD_DOC: "在文件夹中添加文档",
    },

    LABELS: {
        SIDEBAR: "侧边栏导航",
        EXTERNAL_FILE: "外部文件",
        DOCUMENTS: "文档",
        FOLDERS: "文件夹",
        UNCATEGORIZED: "未分类",
        SEARCH_PLACEHOLDER: "搜索文档...",
        NO_MATCH: "未找到相关文档",
        EMPTY_LIST: "暂无文档，点击 + 创建",
        EMPTY_APP: "暂无文档",
        DEFAULT_FOLDER_NAME: "新建文件夹",
    },

    MODALS: {
        DELETE_TITLE: "删除文档",
        DELETE_MESSAGE: "确定要删除此文档吗？此操作不可撤销。",
        DELETE_FOLDER_TITLE: "删除文件夹",
        DELETE_FOLDER_MESSAGE: "确定要删除此文件夹吗？其中的文档将被移至未分类。",
    },

    MENU: {
        NEW_DOC: "新建文档",
        NEW_FOLDER: "新建文件夹",
    }
};

export type StringsType = typeof EN;

export function getStrings(lang: 'en' | 'zh'): StringsType {
    return lang === 'zh' ? ZH : EN;
}

// 保持向后兼容，默认导出或者根据系统语言
const initialLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
export const STRINGS = getStrings(initialLang);
