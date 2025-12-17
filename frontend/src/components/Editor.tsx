import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

interface EditorProps {
  initialContent?: Block[];
  onChange?: (content: Block[]) => void;
  editorRef?: React.MutableRefObject<BlockNoteEditor | null>;
}

export function Editor({ initialContent, onChange, editorRef }: EditorProps) {
  const { theme } = useTheme();

  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
  });

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
