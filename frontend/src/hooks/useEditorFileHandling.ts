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

    // Handle native browser drag/drop events (prevent default file opening)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const shouldBlockDefaultDrop = (event: DragEvent) =>
            event.dataTransfer?.types?.includes("Files") ?? false;

        const handleDragOver = (event: DragEvent) => {
            if (!shouldBlockDefaultDrop(event)) return;
            event.preventDefault();
        };

        const handleDrop = (event: DragEvent) => {
            if (!shouldBlockDefaultDrop(event)) return;
            event.preventDefault();
        };

        container.addEventListener("dragover", handleDragOver);
        container.addEventListener("drop", handleDrop);
        return () => {
            container.removeEventListener("dragover", handleDragOver);
            container.removeEventListener("drop", handleDrop);
        };
    }, []); // Empty dependency array as containerRef.current logic usually inside effect needs ref in deps or assume stable? 
    // Usually ref.current is mutable so effect running once is typically fine if ref attached initially.
    // However, if strict mode/react behavior, better safe. 
    // But ref updates don't trigger re-render. 
    // If containerRef.current is null initially and set later, this effect might miss it if args empty.
    // But `editorContainerRef` in Editor.tsx is attached to `div`. `Editor` renders `div`.
    // So usually ref is populated when effect runs?
    // Actually, ref is guaranteed populated after first render commit.
}
