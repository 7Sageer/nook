import { useState, useCallback } from 'react';
import type { DocDropIndicator, ContainerDropIndicator, ActiveDragItem } from '../types/dnd';

// Re-export types for convenience
export type { DocDropIndicator, ContainerDropIndicator, ActiveDragItem } from '../types/dnd';

/**
 * Hook to manage drop indicator states during drag operations.
 * Extracted from useSidebarDnd for better modularity.
 */
export function useDropIndicator() {
    const [docDropIndicator, setDocDropIndicator] = useState<DocDropIndicator | null>(null);
    const [containerDropIndicator, setContainerDropIndicator] = useState<ContainerDropIndicator | null>(null);
    const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);

    const clearIndicators = useCallback(() => {
        setDocDropIndicator(null);
        setContainerDropIndicator(null);
    }, []);

    const clearAll = useCallback(() => {
        setDocDropIndicator(null);
        setContainerDropIndicator(null);
        setActiveDragItem(null);
    }, []);

    const setDroppedWithAnimation = useCallback((docId: string) => {
        setJustDroppedId(docId);
        // 动画结束后清除状态
        setTimeout(() => setJustDroppedId(null), 300);
    }, []);

    return {
        // State
        docDropIndicator,
        containerDropIndicator,
        justDroppedId,
        activeDragItem,
        // Setters
        setDocDropIndicator,
        setContainerDropIndicator,
        setActiveDragItem,
        // Helpers
        clearIndicators,
        clearAll,
        setDroppedWithAnimation,
    };
}
