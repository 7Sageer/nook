import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { createSmoothCaretPlugin } from "../plugins/smoothCaret";
import "../plugins/smoothCaret.css";
import { SaveImage } from "../../wailsjs/go/main/App";

interface EditorProps {
  initialContent?: Block[];
  onChange?: (content: Block[]) => void;
  editorRef?: React.MutableRefObject<BlockNoteEditor | null>;
}

export function Editor({ initialContent, onChange, editorRef }: EditorProps) {
  const { theme } = useTheme();
  const pluginInjectedRef = useRef(false);

  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
    uploadFile: async (file: File): Promise<string> => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (data:image/png;base64,)
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'png';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Save via Go backend and get file:// URL
      return await SaveImage(base64, filename);
    },
  });

  // Inject smooth caret plugin after editor is created (only once)
  useEffect(() => {
    if (editor && editor._tiptapEditor && !pluginInjectedRef.current) {
      // Access the ProseMirror view and register the plugin
      const view = editor._tiptapEditor.view;
      if (view) {
        try {
          // Create plugin instance
          const smoothCaretPlugin = createSmoothCaretPlugin({
            transitionDuration: 60,
            cursorWidth: 2,
            enableBlink: true,
          });

          // Add plugin to the editor's state
          const { state } = view;
          const newState = state.reconfigure({
            plugins: [...state.plugins, smoothCaretPlugin],
          });
          view.updateState(newState);
          pluginInjectedRef.current = true;

          // 自动聚焦编辑器，让用户可以直接开始输入
          setTimeout(() => {
            editor.focus();
          }, 50);
        } catch (err) {
          console.warn("Failed to inject smooth caret plugin:", err);
        }
      }
    }
  }, [editor]);

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      onChange={() => {
        onChange?.(editor.document);
      }}
    />
  );
}

