import { useEffect, RefObject } from "react";
import { fileToBase64, insertFileBlock } from "../utils/editorExtensions";
import { SaveFile, IndexFileContent } from "../../wailsjs/go/main/App";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

interface UseFileDropProps {
    editor: EditorInstance;
    containerRef: RefObject<HTMLDivElement>;
    docId?: string;
}

export const useFileDrop = ({ editor, containerRef, docId }: UseFileDropProps) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !editor) return;

        const handleDrop = async (event: DragEvent) => {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;

            const file = files[0];
            const ext = file.name.split('.').pop()?.toLowerCase();

            // Only handle supported file types
            if (!['md', 'txt', 'pdf', 'docx', 'html', 'htm'].includes(ext || '')) {
                return; // Let default handler process (e.g., images)
            }

            event.preventDefault();
            event.stopPropagation();

            try {
                const base64 = await fileToBase64(file);
                const fileInfo = await SaveFile(base64, file.name);

                if (fileInfo) {
                    const block = insertFileBlock(editor, fileInfo);
                    // Trigger async indexing (don't await)
                    IndexFileContent(fileInfo.filePath, docId || '', block.id).catch(() => {
                        // Silently ignore indexing errors
                    });
                }
            } catch (err) {
                console.error('Failed to handle file drop:', err);
            }
        };

        // Use capture phase to intercept before BlockNote/TipTap processes
        container.addEventListener('drop', handleDrop, { capture: true });
        return () => container.removeEventListener('drop', handleDrop, { capture: true });
    }, [editor, containerRef, docId]);
};
