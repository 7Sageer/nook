import { useState, useCallback } from 'react';
import {
    pointerWithin,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
    type CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { DocumentMeta } from '../types/document';
import type { DocDropIndicator, PinnedTagDropIndicator } from '../types/dnd';
import { isDocInstanceDndId } from '../utils/dnd';
import { DND_CONSTANTS } from '../constants/strings';

const {
    UNCATEGORIZED_CONTAINER_ID,
    DOC_CONTAINER_PREFIX,
    DOC_CONTAINER_HEADER_PREFIX,
    DOC_CONTAINER_LIST_PREFIX,
} = DND_CONSTANTS;


/**
 * Custom collision detection that prioritizes expanded groups over collapsed ones.
 * For collapsed containers, uses closestCenter to select the nearest target
 * instead of relying on pointerWithin's order (which may favor earlier DOM elements).
 */
export const collisionDetectionWithExpandedPriority: CollisionDetection = (args) => {
    const activeType = args.active?.data?.current?.type;

    // Pinned Tag 拖放：使用 closestCenter 选择最近的 pinned-tag
    if (activeType === 'pinned-tag') {
        const pinnedTagTargets = closestCenter(args).filter(collision => {
            const data = collision.data?.droppableContainer?.data?.current;
            return data?.type === 'pinned-tag';
        });
        return pinnedTagTargets.length > 0 ? pinnedTagTargets : pointerWithin(args);
    }

    // 文档拖放
    let collisions = pointerWithin(args);

    if (activeType === 'document') {
        // 过滤掉 pinned-tag 类型（文档不能直接拖到 pinned-tag 的 sortable 容器）
        collisions = collisions.filter(collision => {
            const data = collision.data?.droppableContainer?.data?.current;
            return data?.type !== 'pinned-tag';
        });
    }

    if (collisions.length <= 1) {
        return collisions;
    }

    // 优先级 1：文档目标（用于同容器内排序）
    const documentTargets = collisions.filter(collision => {
        if (!isDocInstanceDndId(String(collision.id))) return false;
        const data = collision.data?.droppableContainer?.data?.current;
        return data?.type === 'document' && !data?.hidden;
    });

    if (documentTargets.length > 0) {
        return documentTargets;
    }

    // 优先级 2：展开的容器
    const expandedContainers = collisions.filter(collision => {
        const data = collision.data?.droppableContainer?.data?.current;
        return data?.type === 'doc-container' && !data?.collapsed;
    });

    if (expandedContainers.length > 0) {
        return expandedContainers;
    }

    // 优先级 3：折叠的容器 - 使用 closestCenter 选择最近的
    const collapsedContainerIds = new Set(
        collisions
            .filter(c => {
                const data = c.data?.droppableContainer?.data?.current;
                return data?.type === 'doc-container' && data?.collapsed;
            })
            .map(c => c.id)
    );

    if (collapsedContainerIds.size > 0) {
        // 使用 closestCenter 重新计算，只考虑已检测到的折叠容器
        const closestCollisions = closestCenter(args).filter(c => collapsedContainerIds.has(c.id));
        if (closestCollisions.length > 0) {
            return closestCollisions;
        }
    }

    return collisions;
};

const getContainerInfo = (id: string) => {
    if (id.startsWith(DOC_CONTAINER_HEADER_PREFIX)) {
        return { containerId: id.slice(DOC_CONTAINER_HEADER_PREFIX.length), role: 'header' as const };
    }
    if (id.startsWith(DOC_CONTAINER_LIST_PREFIX)) {
        return { containerId: id.slice(DOC_CONTAINER_LIST_PREFIX.length), role: 'list' as const };
    }
    if (id.startsWith(DOC_CONTAINER_PREFIX)) {
        return { containerId: id.slice(DOC_CONTAINER_PREFIX.length), role: 'container' as const };
    }
    return null;
};

interface UseSidebarDnDOptions {
    groupNameSet: Set<string>;
    ungroupedDocs: DocumentMeta[];
    filteredDocsByGroup: Map<string, DocumentMeta[]>;
    addTag: (docId: string, tag: string) => Promise<void>;
    removeTag: (docId: string, tag: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
    pinnedTagOrder: string[];
    reorderPinnedTags: (names: string[]) => Promise<void>;
}

export function useSidebarDnD({
    groupNameSet,
    ungroupedDocs,
    filteredDocsByGroup,
    addTag,
    removeTag,
    reorderDocuments,
    pinnedTagOrder,
    reorderPinnedTags,
}: UseSidebarDnDOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const [activeDragDocId, setActiveDragDocId] = useState<string | null>(null);
    const [sourceGroupName, setSourceGroupName] = useState<string | null>(null);
    const [docDropIndicator, setDocDropIndicator] = useState<DocDropIndicator | null>(null);
    const [pinnedTagDropIndicator, setPinnedTagDropIndicator] = useState<PinnedTagDropIndicator | null>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    // Handle DnD start - track which doc is being dragged and from which group
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setIsDragging(true);
        setDocDropIndicator(null);
        setPinnedTagDropIndicator(null);
        const activeData = event.active.data.current;
        if (activeData?.type === 'document') {
            setActiveDragDocId(activeData.docId);
            // Find the source group (containerId tells us which group it came from)
            const containerId = activeData.containerId;
            if (containerId !== UNCATEGORIZED_CONTAINER_ID && groupNameSet.has(containerId)) {
                setSourceGroupName(containerId);
            } else {
                setSourceGroupName(null);
            }
        }
    }, [groupNameSet]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) {
            setDocDropIndicator(null);
            setPinnedTagDropIndicator(null);
            return;
        }

        const activeData = active.data.current;
        const overData = over.data.current;

        if (activeData?.type === 'document') {
            setPinnedTagDropIndicator(null);
            if (overData?.type === 'document' && !overData.hidden) {
                const activeRect = active.rect.current.translated ?? active.rect.current.initial;
                const overRect = over.rect;
                if (!activeRect || !overRect) {
                    setDocDropIndicator(null);
                    return;
                }
                const activeCenterY = activeRect.top + activeRect.height / 2;
                const overCenterY = overRect.top + overRect.height / 2;
                const position = activeCenterY < overCenterY ? 'before' : 'after';
                setDocDropIndicator({
                    docId: overData.docId,
                    containerId: overData.containerId,
                    position,
                });
                return;
            }
            setDocDropIndicator(null);
            return;
        }

        if (activeData?.type === 'pinned-tag') {
            setDocDropIndicator(null);
            if (overData?.type === 'pinned-tag') {
                const activeRect = active.rect.current.translated ?? active.rect.current.initial;
                const overRect = over.rect;
                if (!activeRect || !overRect) {
                    setPinnedTagDropIndicator(null);
                    return;
                }
                const activeCenterY = activeRect.top + activeRect.height / 2;
                const overCenterY = overRect.top + overRect.height / 2;
                const position = activeCenterY < overCenterY ? 'before' : 'after';
                setPinnedTagDropIndicator({
                    tagName: overData.tagName,
                    position,
                });
                return;
            }
            setPinnedTagDropIndicator(null);
            return;
        }

        setDocDropIndicator(null);
        setPinnedTagDropIndicator(null);
    }, []);

    // Handle DnD end - move by default (remove source, add target), Alt+drag to copy
    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setIsDragging(false);
        setActiveDragDocId(null);
        setDocDropIndicator(null);
        setPinnedTagDropIndicator(null);
        const currentSourceGroup = sourceGroupName;
        setSourceGroupName(null);

        if (!over) return;

        const activeData = active.data.current;
        if (activeData?.type === 'pinned-tag') {
            const overData = over.data.current;
            if (overData?.type !== 'pinned-tag') return;
            const activeName = activeData.tagName;
            const overName = overData.tagName;
            if (!activeName || !overName || activeName === overName) return;
            const oldIndex = pinnedTagOrder.indexOf(activeName);
            const newIndex = pinnedTagOrder.indexOf(overName);
            if (oldIndex < 0 || newIndex < 0) return;
            const newOrder = arrayMove(pinnedTagOrder, oldIndex, newIndex);
            await reorderPinnedTags(newOrder);
            return;
        }
        if (activeData?.type !== 'document') return;

        const docId = activeData.docId;
        const overId = over.id as string;
        const overData = over.data.current;
        const containerInfo = getContainerInfo(overId);

        // Check if Alt/Option key is held (copy mode)
        const isCopyMode = (event.activatorEvent as MouseEvent | undefined)?.altKey ?? false;

        // Case 1: Dropping on a group container (move/copy between groups)
        if (containerInfo) {
            const targetGroup = containerInfo.containerId;
            const targetDocs = targetGroup === UNCATEGORIZED_CONTAINER_ID
                ? ungroupedDocs
                : (filteredDocsByGroup.get(targetGroup) || []);

            if (targetDocs.length > 0 && !(overData?.role === 'header' && overData?.collapsed)) return;

            // Skip if dropping on the same group
            if (targetGroup === currentSourceGroup) return;

            if (targetGroup === UNCATEGORIZED_CONTAINER_ID) {
                // Dropped to uncategorized: remove source group tag
                if (currentSourceGroup) {
                    await removeTag(docId, currentSourceGroup);
                }
            } else {
                // Dropped to a group
                // Move: remove source tag first (if exists and different), then add target
                if (!isCopyMode && currentSourceGroup && currentSourceGroup !== targetGroup) {
                    await removeTag(docId, currentSourceGroup);
                }
                await addTag(docId, targetGroup);
            }
            return;
        }

        // Case 2: Dropping on another document
        if (overData?.type === 'document' && !overData.hidden) {
            const sourceContainerId = activeData.containerId;
            const targetContainerId = overData.containerId;

            // Same container: reorder
            if (sourceContainerId === targetContainerId) {
                // Get documents in this container
                let containerDocs: DocumentMeta[];
                if (sourceContainerId === UNCATEGORIZED_CONTAINER_ID) {
                    containerDocs = ungroupedDocs;
                } else {
                    containerDocs = filteredDocsByGroup.get(sourceContainerId) || [];
                }

                // Find indices
                const sortedDocs = [...containerDocs].sort((a, b) => a.order - b.order);
                const activeIndex = sortedDocs.findIndex(d => d.id === docId);
                const overIndex = sortedDocs.findIndex(d => d.id === overData.docId);

                if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                    // Create new order
                    const newOrder = [...sortedDocs];
                    const [removed] = newOrder.splice(activeIndex, 1);
                    newOrder.splice(overIndex, 0, removed);

                    // Call reorder with new IDs order
                    await reorderDocuments(newOrder.map(d => d.id));
                }
            } else {
                // Different container: move between groups
                const isCopyMode = (event.activatorEvent as MouseEvent | undefined)?.altKey ?? false;

                if (targetContainerId === UNCATEGORIZED_CONTAINER_ID) {
                    // Moving to uncategorized: remove source group tag
                    if (currentSourceGroup) {
                        await removeTag(docId, currentSourceGroup);
                    }
                } else {
                    // Moving to a different group
                    if (!isCopyMode && currentSourceGroup && currentSourceGroup !== targetContainerId) {
                        await removeTag(docId, currentSourceGroup);
                    }
                    await addTag(docId, targetContainerId);
                }
            }
        }
    }, [sourceGroupName, addTag, removeTag, ungroupedDocs, filteredDocsByGroup, reorderDocuments, pinnedTagOrder, reorderPinnedTags]);

    const handleDragCancel = useCallback(() => {
        setIsDragging(false);
        setActiveDragDocId(null);
        setSourceGroupName(null);
        setDocDropIndicator(null);
        setPinnedTagDropIndicator(null);
    }, []);

    return {
        isDragging,
        activeDragDocId,
        docDropIndicator,
        pinnedTagDropIndicator,
        sensors,
        collisionDetection: collisionDetectionWithExpandedPriority,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
    };
}
