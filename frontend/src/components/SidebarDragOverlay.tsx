import { DragOverlay } from '@dnd-kit/core';
import { FileText, ChevronRight, FolderOpen } from 'lucide-react';
import type { DocumentMeta, Folder } from '../types/document';

interface SidebarDragOverlayProps {
    activeDragItem: { type: 'document' | 'folder'; id: string } | null;
    documents: DocumentMeta[];
    folders: Folder[];
    docsByContainer: Map<string, DocumentMeta[]>;
}

export function SidebarDragOverlay({
    activeDragItem,
    documents,
    folders,
    docsByContainer,
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
            {activeDragItem?.type === 'folder' && (() => {
                const folder = folders.find(f => f.id === activeDragItem.id);
                if (!folder) return null;
                const folderDocs = docsByContainer.get(folder.id) || [];
                return (
                    <div className="folder-item drag-overlay">
                        <div className="folder-header">
                            <span className="folder-chevron expanded">
                                <ChevronRight size={16} />
                            </span>
                            <FolderOpen size={16} className="folder-icon" />
                            <span className="folder-name">{folder.name}</span>
                            <span className="folder-count">{folderDocs.length}</span>
                        </div>
                    </div>
                );
            })()}
        </DragOverlay>
    );
}
