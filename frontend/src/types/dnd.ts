/**
 * DnD (Drag and Drop) 相关类型定义
 */

/** 文档拖放指示器 */
export interface DocDropIndicator {
    docId: string;
    containerId: string;
    position: 'before' | 'after';
}

/** 容器拖放指示器 */
export interface ContainerDropIndicator {
    containerId: string;
}

export interface PinnedTagDropIndicator {
    tagName: string;
    position: 'before' | 'after';
}

/** 当前拖拽项 */
export interface ActiveDragItem {
    type: 'document' | 'folder';
    id: string;
}
