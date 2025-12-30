import { useState, useCallback } from 'react';
import {
    pointerWithin,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type CollisionDetection,
} from '@dnd-kit/core';
import type { DocumentMeta } from '../types/document';

const UNCATEGORIZED_CONTAINER_ID = '__uncategorized__';

/**
 * Custom collision detection that prioritizes expanded groups over collapsed ones.
 * When dragging across collapsed groups, they won't be selected unless they are the
 * only match (i.e., pointer is directly on the collapsed group's header).
 */
export const collisionDetectionWithExpandedPriority: CollisionDetection = (args) => {
    const collisions = pointerWithin(args);

    if (collisions.length <= 1) {
        return collisions;
    }

    // Check if any collision is with an expanded (non-collapsed) doc-container
    const expandedContainers = collisions.filter(collision => {
        const data = collision.data?.droppableContainer?.data?.current;
        return data?.type === 'doc-container' && !data?.collapsed;
    });

    // If there are expanded containers, prefer them
    if (expandedContainers.length > 0) {
        return expandedContainers;
    }

    // Otherwise return original collisions
    return collisions;
};

interface UseSidebarDnDOptions {
    groupNameSet: Set<string>;
    ungroupedDocs: DocumentMeta[];
    filteredDocsByGroup: Map<string, DocumentMeta[]>;
    addTag: (docId: string, tag: string) => Promise<void>;
    removeTag: (docId: string, tag: string) => Promise<void>;
    reorderDocuments: (ids: string[]) => Promise<void>;
}

export function useSidebarDnD({
    groupNameSet,
    ungroupedDocs,
    filteredDocsByGroup,
    addTag,
    removeTag,
    reorderDocuments,
}: UseSidebarDnDOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const [activeDragDocId, setActiveDragDocId] = useState<string | null>(null);
    const [sourceGroupName, setSourceGroupName] = useState<string | null>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    // Handle DnD start - track which doc is being dragged and from which group
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setIsDragging(true);
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

    // Handle DnD end - move by default (remove source, add target), Alt+drag to copy
    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setIsDragging(false);
        setActiveDragDocId(null);
        const currentSourceGroup = sourceGroupName;
        setSourceGroupName(null);

        if (!over) return;

        const activeData = active.data.current;
        if (activeData?.type !== 'document') return;

        const docId = activeData.docId;
        const overId = over.id as string;
        const overData = over.data.current;

        // Check if Alt/Option key is held (copy mode)
        const isCopyMode = (event.activatorEvent as MouseEvent | undefined)?.altKey ?? false;

        // Case 1: Dropping on a group container (move/copy between groups)
        if (overId.startsWith('doc-container:')) {
            const targetGroup = overId.replace('doc-container:', '');

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
        if (overData?.type === 'document') {
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
    }, [sourceGroupName, addTag, removeTag, ungroupedDocs, filteredDocsByGroup, reorderDocuments]);

    const handleDragCancel = useCallback(() => {
        setIsDragging(false);
        setActiveDragDocId(null);
        setSourceGroupName(null);
    }, []);

    return {
        isDragging,
        activeDragDocId,
        sensors,
        collisionDetection: collisionDetectionWithExpandedPriority,
        handleDragStart,
        handleDragEnd,
        handleDragCancel,
    };
}
