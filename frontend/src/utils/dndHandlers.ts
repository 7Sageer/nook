import { arrayMove } from '@dnd-kit/sortable';
import type { Folder, DocumentMeta } from '../types/document';
import { UNCATEGORIZED_CONTAINER_ID, parseDocId, parseFolderId, parseDocContainerId, isDocDndId, isFolderDndId, isDocContainerDndId } from './dnd';

// ========== Types ==========

export interface DndDragEndContext {
    activeId: string;
    overId: string;
    activeRect: {
        top: number;
        height: number;
    } | null;
    overRect: {
        top: number;
        height: number;
    };
    activeDataContainerId?: string;
    overDataContainerId?: string;
}

export interface DndState {
    sortedFolders: Folder[];
    containerIdByDocId: Map<string, string>;
    docIdsByContainer: Map<string, string[]>;
    folderIdSet: Set<string>;
}

export interface DndActions {
    moveDocumentToFolder: (docId: string, folderId: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
    reorderFolders: (ids: string[]) => Promise<void>;
}

// ========== Folder Reorder ==========

/**
 * Handle folder reordering when a folder is dropped on another folder
 */
export async function handleFolderReorder(
    context: DndDragEndContext,
    state: DndState,
    actions: DndActions
): Promise<boolean> {
    if (!isFolderDndId(context.activeId) || !isFolderDndId(context.overId)) {
        return false;
    }

    const activeFolderId = parseFolderId(context.activeId);
    const overFolderId = parseFolderId(context.overId);

    if (!activeFolderId || !overFolderId || activeFolderId === overFolderId) {
        return false;
    }

    const currentIds = state.sortedFolders.map((f) => f.id);
    const oldIndex = currentIds.indexOf(activeFolderId);
    const newIndex = currentIds.indexOf(overFolderId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return false;
    }

    await actions.reorderFolders(arrayMove(currentIds, oldIndex, newIndex));
    return true;
}

// ========== Document Reorder ==========

/**
 * Determine if the item should be inserted after the target based on position
 */
function shouldInsertAfter(context: DndDragEndContext): boolean {
    if (!context.activeRect) return false;
    const activeCenterY = context.activeRect.top + context.activeRect.height / 2;
    const overMiddleY = context.overRect.top + context.overRect.height / 2;
    return activeCenterY > overMiddleY;
}

/**
 * Clone the document IDs by container map
 */
function cloneDocIdsByContainer(source: Map<string, string[]>): Map<string, string[]> {
    const next = new Map<string, string[]>();
    for (const [containerId, ids] of source) {
        next.set(containerId, [...ids]);
    }
    return next;
}

/**
 * Calculate insert index for a document
 */
function calculateInsertIndex(
    targetIds: string[],
    overDocId: string | null,
    insertAfter: boolean
): number {
    if (!overDocId) return 0;
    const overIndex = targetIds.indexOf(overDocId);
    if (overIndex === -1) return 0;
    return overIndex + (insertAfter ? 1 : 0);
}

/**
 * Collect all document IDs in order across all containers
 */
function collectAllDocumentIds(
    docIdsByContainer: Map<string, string[]>,
    sortedFolders: Folder[],
    folderIdSet: Set<string>
): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    const pushAll = (ids: string[]) => {
        for (const id of ids) {
            if (seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
    };

    // Uncategorized first
    pushAll(docIdsByContainer.get(UNCATEGORIZED_CONTAINER_ID) ?? []);

    // Then folders in order
    for (const folder of sortedFolders) {
        pushAll(docIdsByContainer.get(folder.id) ?? []);
    }

    // Any remaining containers
    for (const [containerId, ids] of docIdsByContainer) {
        if (containerId === UNCATEGORIZED_CONTAINER_ID) continue;
        if (folderIdSet.has(containerId)) continue;
        pushAll(ids);
    }

    return result;
}

/**
 * Handle document drag end - reorder within or across containers
 */
export async function handleDocumentDragEnd(
    context: DndDragEndContext,
    state: DndState,
    actions: DndActions
): Promise<string | null> {
    if (!isDocDndId(context.activeId)) {
        return null;
    }

    const activeDocId = parseDocId(context.activeId);
    if (!activeDocId) return null;

    // Determine source container
    const sourceContainerId =
        context.activeDataContainerId ??
        state.containerIdByDocId.get(activeDocId) ??
        UNCATEGORIZED_CONTAINER_ID;

    // Determine target container
    const overContainerId =
        context.overDataContainerId ??
        (isDocContainerDndId(context.overId) ? parseDocContainerId(context.overId) : null) ??
        UNCATEGORIZED_CONTAINER_ID;

    if (!overContainerId) return null;

    // Get target doc if dropping on a doc
    const overDocId = isDocDndId(context.overId) ? parseDocId(context.overId) : null;

    // Skip if dropping on self in same container
    if (overDocId && overDocId === activeDocId && sourceContainerId === overContainerId) {
        return null;
    }

    const nextDocIdsByContainer = cloneDocIdsByContainer(state.docIdsByContainer);
    const sourceIds = nextDocIdsByContainer.get(sourceContainerId) ?? [];
    const oldIndex = sourceIds.indexOf(activeDocId);

    if (oldIndex === -1) return null;

    const insertAfter = shouldInsertAfter(context);

    if (sourceContainerId === overContainerId) {
        // Reorder within same container
        const nextIds = [...sourceIds];
        nextIds.splice(oldIndex, 1);
        const insertIndex = calculateInsertIndex(nextIds, overDocId, insertAfter);
        nextIds.splice(insertIndex, 0, activeDocId);
        nextDocIdsByContainer.set(sourceContainerId, nextIds);
    } else {
        // Move to different container
        const nextSourceIds = [...sourceIds];
        nextSourceIds.splice(oldIndex, 1);
        nextDocIdsByContainer.set(sourceContainerId, nextSourceIds);

        const targetIds = nextDocIdsByContainer.get(overContainerId) ?? [];
        const nextTargetIds = [...targetIds];
        const insertIndex = calculateInsertIndex(nextTargetIds, overDocId, insertAfter);
        nextTargetIds.splice(insertIndex, 0, activeDocId);
        nextDocIdsByContainer.set(overContainerId, nextTargetIds);

        // Move document to new folder
        await actions.moveDocumentToFolder(
            activeDocId,
            overContainerId === UNCATEGORIZED_CONTAINER_ID ? '' : overContainerId
        );
    }

    // Reorder all documents
    const allDocIds = collectAllDocumentIds(
        nextDocIdsByContainer,
        state.sortedFolders,
        state.folderIdSet
    );
    await actions.reorderDocuments(allDocIds);

    return activeDocId;
}
