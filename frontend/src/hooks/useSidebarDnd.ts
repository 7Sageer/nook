import { useCallback, useState } from 'react';
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
import { arrayMove } from '@dnd-kit/sortable';
import {
    UNCATEGORIZED_CONTAINER_ID,
    isDocContainerDndId,
    isDocDndId,
    isFolderDndId,
    parseDocContainerId,
    parseDocId,
    parseFolderId,
} from '../utils/dnd';
import type { Folder } from '../types/document';

interface UseSidebarDndOptions {
    sortedFolders: Folder[];
    containerIdByDocId: Map<string, string>;
    docIdsByContainer: Map<string, string[]>;
    folderIdSet: Set<string>;
    moveDocumentToFolder: (docId: string, folderId: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
    reorderFolders: (ids: string[]) => Promise<void>;
}

interface DocDropIndicator {
    docId: string;
    position: 'before' | 'after';
}

interface ContainerDropIndicator {
    containerId: string;
}

interface ActiveDragItem {
    type: 'document' | 'folder';
    id: string;
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
    const [docDropIndicator, setDocDropIndicator] = useState<DocDropIndicator | null>(null);
    const [containerDropIndicator, setContainerDropIndicator] = useState<ContainerDropIndicator | null>(null);
    const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);

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

            // 设置刚放下的文档 ID，触发落地动画
            if (isDocDndId(activeId)) {
                const droppedDocId = parseDocId(activeId);
                if (droppedDocId) {
                    setJustDroppedId(droppedDocId);
                    // 动画结束后清除状态
                    setTimeout(() => setJustDroppedId(null), 300);
                }
            }

            if (isFolderDndId(activeId) && isFolderDndId(overId)) {
                const activeFolderId = parseFolderId(activeId);
                const overFolderId = parseFolderId(overId);
                if (!activeFolderId || !overFolderId || activeFolderId === overFolderId) return;

                const currentIds = sortedFolders.map((f) => f.id);
                const oldIndex = currentIds.indexOf(activeFolderId);
                const newIndex = currentIds.indexOf(overFolderId);
                if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

                await reorderFolders(arrayMove(currentIds, oldIndex, newIndex));
                return;
            }

            if (!isDocDndId(activeId)) return;

            const activeDocId = parseDocId(activeId);
            if (!activeDocId) return;

            const sourceContainerId =
                (active.data.current as { containerId?: string } | null)?.containerId ??
                containerIdByDocId.get(activeDocId) ??
                UNCATEGORIZED_CONTAINER_ID;

            const overContainerIdFromData = (over.data.current as { containerId?: string } | null)
                ?.containerId;

            const overContainerId =
                overContainerIdFromData ??
                (isDocContainerDndId(overId) ? parseDocContainerId(overId) : null) ??
                UNCATEGORIZED_CONTAINER_ID;

            if (!overContainerId) return;

            const overDocId = isDocDndId(overId) ? parseDocId(overId) : null;
            if (overDocId && overDocId === activeDocId && sourceContainerId === overContainerId) return;

            const cloneDocIdsByContainer = (source: Map<string, string[]>) => {
                const next = new Map<string, string[]>();
                for (const [containerId, ids] of source) {
                    next.set(containerId, [...ids]);
                }
                return next;
            };

            const nextDocIdsByContainer = cloneDocIdsByContainer(docIdsByContainer);
            const sourceIds = nextDocIdsByContainer.get(sourceContainerId) ?? [];
            const targetIds = nextDocIdsByContainer.get(overContainerId) ?? [];

            const oldIndex = sourceIds.indexOf(activeDocId);

            const getInsertAfter = () => {
                const activeRect = active.rect.current.translated ?? active.rect.current.initial;
                if (!activeRect) return false;
                const activeCenterY = activeRect.top + activeRect.height / 2;
                const overMiddleY = over.rect.top + over.rect.height / 2;
                return activeCenterY > overMiddleY;
            };

            if (sourceContainerId === overContainerId) {
                if (oldIndex === -1) return;

                const nextIds = [...sourceIds];
                nextIds.splice(oldIndex, 1);

                const insertIndex = (() => {
                    if (!overDocId) return 0;
                    const overIndex = nextIds.indexOf(overDocId);
                    if (overIndex === -1) return 0;
                    return overIndex + (getInsertAfter() ? 1 : 0);
                })();

                nextIds.splice(insertIndex, 0, activeDocId);
                nextDocIdsByContainer.set(sourceContainerId, nextIds);
            } else {
                if (oldIndex === -1) return;

                const nextSourceIds = [...sourceIds];
                nextSourceIds.splice(oldIndex, 1);
                nextDocIdsByContainer.set(sourceContainerId, nextSourceIds);

                const nextTargetIds = [...targetIds];
                const insertIndex = (() => {
                    if (!overDocId) return 0;
                    const overIndex = nextTargetIds.indexOf(overDocId);
                    if (overIndex === -1) return 0;
                    return overIndex + (getInsertAfter() ? 1 : 0);
                })();
                nextTargetIds.splice(insertIndex, 0, activeDocId);
                nextDocIdsByContainer.set(overContainerId, nextTargetIds);

                await moveDocumentToFolder(
                    activeDocId,
                    overContainerId === UNCATEGORIZED_CONTAINER_ID ? '' : overContainerId
                );
            }

            const nextAllDocIds: string[] = [];
            const seen = new Set<string>();

            const pushAll = (ids: string[]) => {
                for (const id of ids) {
                    if (seen.has(id)) continue;
                    seen.add(id);
                    nextAllDocIds.push(id);
                }
            };

            pushAll(nextDocIdsByContainer.get(UNCATEGORIZED_CONTAINER_ID) ?? []);
            for (const folder of sortedFolders) {
                pushAll(nextDocIdsByContainer.get(folder.id) ?? []);
            }
            for (const [containerId, ids] of nextDocIdsByContainer) {
                if (containerId === UNCATEGORIZED_CONTAINER_ID) continue;
                if (folderIdSet.has(containerId)) continue;
                pushAll(ids);
            }

            await reorderDocuments(nextAllDocIds);
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
