import { useMemo, useCallback, memo, forwardRef } from 'react';
import type { DocumentMeta, Folder } from '../types/document';
import type { DocDropIndicator, ContainerDropIndicator } from '../types/dnd';
import { FolderItem } from './FolderItem';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { folderDndId } from '../utils/dnd';

// 文件夹动画配置
export const folderVariants = {
    initial: { opacity: 0, x: -12 },
    animate: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: {
            delay: i * 0.04,
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1] as const,
        },
    }),
    exit: {
        opacity: 0,
        x: -20,
        scale: 0.95,
        transition: {
            duration: 0.15,
            ease: [0.4, 0, 1, 1] as const,
        },
    },
};

interface SortableFolderWrapperProps {
    folder: Folder;
    index: number;
    documents: DocumentMeta[];
    disabled: boolean;
    activeDocId: string | null;
    onToggleFolder: (folderId: string) => Promise<void> | void;
    onRenameFolder: (folderId: string, name: string) => Promise<void> | void;
    onDeleteFolder: (folderId: string) => void;
    onSelectDocument: (docId: string) => void;
    onDeleteDocument: (docId: string) => void;
    onEditingFolderChange: (folderId: string | null) => void;
    onAddDocumentInFolder: (folderId: string) => Promise<void> | void;
    dropIndicator?: DocDropIndicator | null;
    containerDropIndicator?: ContainerDropIndicator | null;
    justDroppedId?: string | null;
}

export const SortableFolderWrapper = memo(forwardRef<HTMLDivElement, SortableFolderWrapperProps>(function SortableFolderWrapper({
    folder,
    index,
    documents,
    disabled,
    activeDocId,
    onToggleFolder,
    onRenameFolder,
    onDeleteFolder,
    onSelectDocument,
    onDeleteDocument,
    onEditingFolderChange,
    onAddDocumentInFolder,
    dropIndicator,
    containerDropIndicator,
    justDroppedId,
}, ref) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: folderDndId(folder.id),
        disabled,
        data: { type: 'folder', folderId: folder.id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    const folderDragHandleProps = useMemo<React.HTMLAttributes<HTMLDivElement>>(
        () => ({ ...attributes, ...listeners }),
        [attributes, listeners]
    );

    const handleToggle = useCallback(() => {
        void onToggleFolder(folder.id);
    }, [onToggleFolder, folder.id]);

    const handleRename = useCallback(
        (name: string) => {
            void onRenameFolder(folder.id, name);
        },
        [onRenameFolder, folder.id]
    );

    const handleDelete = useCallback(() => {
        onDeleteFolder(folder.id);
    }, [onDeleteFolder, folder.id]);

    const handleEditingChange = useCallback(
        (isEditing: boolean) => {
            onEditingFolderChange(isEditing ? folder.id : null);
        },
        [onEditingFolderChange, folder.id]
    );

    const handleAddDocument = useCallback(() => {
        void onAddDocumentInFolder(folder.id);
    }, [onAddDocumentInFolder, folder.id]);

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            layout={!isDragging}
            variants={folderVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={index}
            className={`folder-wrapper sortable ${isDragging ? 'is-dragging' : ''}`}
        >
            <FolderItem
                folder={folder}
                documents={documents}
                activeDocId={activeDocId}
                onToggle={handleToggle}
                onRename={handleRename}
                onDelete={handleDelete}
                onSelectDocument={onSelectDocument}
                onDeleteDocument={onDeleteDocument}
                onEditingChange={handleEditingChange}
                onAddDocument={handleAddDocument}
                folderDragHandleProps={folderDragHandleProps}
                dropIndicator={dropIndicator}
                containerDropIndicator={containerDropIndicator}
                justDroppedId={justDroppedId}
            />
        </motion.div>
    );
}));
