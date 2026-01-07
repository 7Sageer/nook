import { DragOverlay } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import type { DocumentMeta } from '../../types/document';

interface SidebarDragOverlayProps {
    activeDragItem: { type: 'document'; id: string } | null;
    documents: DocumentMeta[];
}

export function SidebarDragOverlay({
    activeDragItem,
    documents,
}: SidebarDragOverlayProps) {
    return (
        <DragOverlay dropAnimation={null}>
            {activeDragItem?.type === 'document' && (() => {
                const doc = documents.find(d => d.id === activeDragItem.id);
                if (!doc) return null;
                return (
                    <div className="document-item drag-overlay">
                        <FileText size={16} className="doc-icon" />
                        <div className="doc-content">
                            <span className="doc-title">{doc.title}</span>
                        </div>
                    </div>
                );
            })()}
        </DragOverlay>
    );
}
