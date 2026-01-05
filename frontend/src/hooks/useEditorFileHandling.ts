import { useEffect, RefObject } from "react";
import { useFileDrop } from "./useFileDrop";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorInstance = any;

interface UseEditorFileHandlingProps {
    editor: EditorInstance;
    docId?: string;
    containerRef: RefObject<HTMLElement>;
}

export function useEditorFileHandling({ editor, docId, containerRef }: UseEditorFileHandlingProps) {
    // Handle Wails file drop events
    useFileDrop({ editor, docId });

    // Block browser default file opening behavior globally
    // This is critical to prevent PDF/images from opening in WebView
    useEffect(() => {
        const blockFileDrop = (event: DragEvent) => {
            // Only block if Files are being dragged
            if (event.dataTransfer?.types?.includes("Files")) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        // Use capture phase to intercept events before they reach any other handler
        window.addEventListener("dragover", blockFileDrop, { capture: true });
        window.addEventListener("drop", blockFileDrop, { capture: true });

        return () => {
            window.removeEventListener("dragover", blockFileDrop, { capture: true });
            window.removeEventListener("drop", blockFileDrop, { capture: true });
        };
    }, []);

    // Also block on the container for extra safety
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleDragOver = (event: DragEvent) => {
            if (event.dataTransfer?.types?.includes("Files")) {
                event.preventDefault();
            }
        };

        const handleDrop = (event: DragEvent) => {
            if (event.dataTransfer?.types?.includes("Files")) {
                event.preventDefault();
            }
        };

        container.addEventListener("dragover", handleDragOver);
        container.addEventListener("drop", handleDrop);
        return () => {
            container.removeEventListener("dragover", handleDragOver);
            container.removeEventListener("drop", handleDrop);
        };
    }, [containerRef]);
}
