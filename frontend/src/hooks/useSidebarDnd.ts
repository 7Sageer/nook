import { useCallback } from 'react';
import {
    closestCenter,
    type CollisionDetection,
    type DragEndEvent,
    type DragMoveEvent,
    type DragStartEvent,
    PointerSensor,
    pointerWithin,
    rectIntersection,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    UNCATEGORIZED_CONTAINER_ID,
    isDocContainerDndId,
    isDocDndId,
    isFolderDndId,
    parseDocContainerId,
    parseDocId,
    parseFolderId,
} from '../utils/dnd';
import {
    handleFolderReorder,
    handleDocumentDragEnd,
    type DndDragEndContext,
    type DndState,
    type DndActions,
} from '../utils/dndHandlers';
import type { Folder } from '../types/document';
import { useDropIndicator } from './useDropIndicator';

interface UseSidebarDndOptions {
    sortedFolders: Folder[];
    containerIdByDocId: Map<string, string>;
    docIdsByContainer: Map<string, string[]>;
    folderIdSet: Set<string>;
    moveDocumentToFolder: (docId: string, folderId: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
    reorderFolders: (ids: string[]) => Promise<void>;
}

export function useSidebarDnd({
    sortedFolders,
    containerIdByDocId,
    docIdsByContainer,
    folderIdSet,
    moveDocumentToFolder,
    reorderDocuments,
    reorderFolders,
}: UseSidebarDndOptions) {
    const {
        docDropIndicator,
        containerDropIndicator,
        justDroppedId,
        activeDragItem,
        setDocDropIndicator,
        setContainerDropIndicator,
        setActiveDragItem,
        clearIndicators,
        clearAll,
        setDroppedWithAnimation,
    } = useDropIndicator();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );


    const collisionDetection: CollisionDetection = useCallback((args) => {
        const activeId = String(args.active.id);

        if (isFolderDndId(activeId)) {
            return closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter((container) =>
                    isFolderDndId(String(container.id))
                ),
            });
        }

        if (isDocDndId(activeId)) {
            const docDroppables = args.droppableContainers.filter((container) => {
                const id = String(container.id);
                return isDocDndId(id) || isDocContainerDndId(id);
            });

            const pointerCollisions = pointerWithin({ ...args, droppableContainers: docDroppables });
            const pointerDocCollisions = pointerCollisions.filter((collision) =>
                isDocDndId(String(collision.id))
            );

            if (pointerDocCollisions.length > 0) return pointerDocCollisions;
            if (pointerCollisions.length > 0) return pointerCollisions;

            return rectIntersection({ ...args, droppableContainers: docDroppables });
        }

        return closestCenter(args);
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setDocDropIndicator(null);
        setContainerDropIndicator(null);

        const activeId = String(event.active.id);
        if (isDocDndId(activeId)) {
            const docId = parseDocId(activeId);
            if (docId) {
                setActiveDragItem({ type: 'document', id: docId });
            }
        } else if (isFolderDndId(activeId)) {
            const folderId = parseFolderId(activeId);
            if (folderId) {
                setActiveDragItem({ type: 'folder', id: folderId });
            }
        }
    }, []);

    const handleDragMove = useCallback(({ active, over }: DragMoveEvent) => {
        const activeId = String(active.id);
        if (!isDocDndId(activeId) || !over) {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
            return;
        }

        const overId = String(over.id);

        if (isDocContainerDndId(overId)) {
            const containerId =
                (over.data.current as { containerId?: string } | null)?.containerId ?? parseDocContainerId(overId);
            if (!containerId) {
                setDocDropIndicator(null);
                setContainerDropIndicator(null);
                return;
            }

            setDocDropIndicator(null);
            setContainerDropIndicator({ containerId });
            return;
        }

        if (!isDocDndId(overId)) {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
            return;
        }

        const activeDocId = parseDocId(activeId);
        const overDocId = parseDocId(overId);
        if (!activeDocId || !overDocId || activeDocId === overDocId) {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
            return;
        }

        const activeRect = active.rect.current.translated ?? active.rect.current.initial;
        if (!activeRect) {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
            return;
        }

        const activeCenterY = activeRect.top + activeRect.height / 2;
        const overMiddleY = over.rect.top + over.rect.height / 2;
        const position: 'before' | 'after' = activeCenterY > overMiddleY ? 'after' : 'before';

        setDocDropIndicator((prev) => {
            if (prev?.docId === overDocId && prev.position === position) return prev;
            return { docId: overDocId, position };
        });
        setContainerDropIndicator(null);
    }, []);

    const handleDragEnd = useCallback(
        async ({ active, over }: DragEndEvent) => {
            setDocDropIndicator(null);
            setContainerDropIndicator(null);
            setActiveDragItem(null);
            if (!over) return;

            const activeId = String(active.id);
            const overId = String(over.id);

            // Build context for handlers
            const activeRect = active.rect.current.translated ?? active.rect.current.initial;
            const context: DndDragEndContext = {
                activeId,
                overId,
                activeRect: activeRect ? { top: activeRect.top, height: activeRect.height } : null,
                overRect: { top: over.rect.top, height: over.rect.height },
                activeDataContainerId: (active.data.current as { containerId?: string } | null)?.containerId,
                overDataContainerId: (over.data.current as { containerId?: string } | null)?.containerId,
            };

            const state: DndState = {
                sortedFolders,
                containerIdByDocId,
                docIdsByContainer,
                folderIdSet,
            };

            const actions: DndActions = {
                moveDocumentToFolder,
                reorderDocuments,
                reorderFolders,
            };

            // Handle folder reordering
            const folderHandled = await handleFolderReorder(context, state, actions);
            if (folderHandled) return;

            // Handle document drag
            const droppedDocId = await handleDocumentDragEnd(context, state, actions);
            if (droppedDocId) {
                setDroppedWithAnimation(droppedDocId);
            }
        },
        [
            containerIdByDocId,
            docIdsByContainer,
            folderIdSet,
            moveDocumentToFolder,
            reorderDocuments,
            reorderFolders,
            sortedFolders,
        ]
    );

    const handleDragCancel = useCallback(() => {
        setDocDropIndicator(null);
        setContainerDropIndicator(null);
        setActiveDragItem(null);
    }, []);

    return {
        sensors,
        collisionDetection,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleDragCancel,
        docDropIndicator,
        containerDropIndicator,
        activeDragItem,
        justDroppedId,
    };
}
