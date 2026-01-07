import { useEffect, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockNoteEditor = any; // Avoid complex type imports if possible, or import properly if project setup is standard
// The original file used "any" for editorRef, but editor was from useCreateBlockNote which returns a typed editor.
// However, the import path was "@blocknote/core".
// Let's try to import the type if we can, to be typesafe, or replicate what Editor.tsx did.
// Editor.tsx used: import { useCreateBlockNote } from "@blocknote/react";
// and internal editor was `type InternalEditor = any;`
// But plugin injection used `editor._tiptapEditor`.
// Let's assume passed editor has _tiptapEditor.

import { createSmoothCaretPlugin } from "../../plugins/smoothCaret";
import { createBookmarkSelectionPlugin } from "../../plugins/bookmarkSelection";
import { createChineseIMEPlugin } from "../../utils/editorExtensions";

export function useEditorPlugins(editor: BlockNoteEditor | null) {
    const pluginInjectedRef = useRef(false);

    useEffect(() => {
        if (editor && editor._tiptapEditor && !pluginInjectedRef.current) {
            const view = editor._tiptapEditor.view;
            if (view) {
                try {
                    // Set bookmark node as atomic to prevent selecting internal content
                    const bookmarkNodeType = view.state.schema.nodes.bookmark;
                    if (bookmarkNodeType) {
                        // Directly modify the node type spec to make it atomic
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (bookmarkNodeType.spec as any).atom = true;
                    }

                    // Create plugins
                    const smoothCaretPlugin = createSmoothCaretPlugin({
                        transitionDuration: 60,
                        cursorWidth: 2,
                        enableBlink: true,
                    });
                    const bookmarkSelectionPlugin = createBookmarkSelectionPlugin();
                    const chineseIMEPlugin = createChineseIMEPlugin(editor);

                    // Add plugins to the editor's state
                    // Note: pasteLinkPlugin is now registered via pasteLinkExtension in useCreateBlockNote
                    const { state } = view;
                    const newState = state.reconfigure({
                        plugins: [...state.plugins, smoothCaretPlugin, bookmarkSelectionPlugin, chineseIMEPlugin],
                    });
                    view.updateState(newState);
                    pluginInjectedRef.current = true;

                    // Auto-focus editor for immediate input
                    setTimeout(() => {
                        editor.focus();
                    }, 50);
                } catch (err) {
                    console.warn("Failed to inject editor plugins:", err);
                }
            }
        }
    }, [editor]);
}
