import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { useEffect, useRef, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { createSmoothCaretPlugin } from "../plugins/smoothCaret";
import "../plugins/smoothCaret.css";
import { SaveImage } from "../../wailsjs/go/main/App";
import { BookmarkBlock } from "./blocks/BookmarkBlock";
import { useDragPreviewFix } from "../hooks/useDragPreviewFix";

interface EditorProps {
  initialContent?: any[];
  onChange?: (content: any[]) => void;
  editorRef?: React.MutableRefObject<any>;
}

// Mirrors BlockNote's default slash-menu behavior: if the current block is empty
// (or only contains the trigger "/"), update it in-place; otherwise insert
// below and move the selection to the next editable block.
function setSelectionToNextContentEditableBlock(editor: any) {
  let block = editor.getTextCursorPosition().block;
  let contentType = editor.schema.blockSchema[block.type].content;

  while (contentType === "none") {
    block = editor.getTextCursorPosition().nextBlock;
    if (!block) return;
    contentType = editor.schema.blockSchema[block.type].content;
    editor.setTextCursorPosition(block, "end");
  }
}

function insertOrUpdateBookmarkForSlashMenu(editor: any) {
  const currentBlock = editor.getTextCursorPosition().block;
  const currentContent = currentBlock.content;

  const isEmptyOrSlash =
    Array.isArray(currentContent) &&
    (currentContent.length === 0 ||
      (currentContent.length === 1 &&
        currentContent[0]?.type === "text" &&
        currentContent[0]?.text === "/"));

  const newBlock = isEmptyOrSlash
    ? editor.updateBlock(currentBlock, { type: "bookmark" as const })
    : editor.insertBlocks([{ type: "bookmark" as const }], currentBlock, "after")[0];

  editor.setTextCursorPosition(newBlock);
  setSelectionToNextContentEditableBlock(editor);

  return newBlock;
}

// Custom slash menu item for bookmark
const insertBookmark = (editor: any) => ({
  title: "Bookmark",
  onItemClick: () => {
    insertOrUpdateBookmarkForSlashMenu(editor);
  },
  aliases: ["bookmark", "link", "embed", "url"],
  group: "Media",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  subtext: "Embed a link with preview",
});

export function Editor({ initialContent, onChange, editorRef }: EditorProps) {
  const { theme } = useTheme();
  const pluginInjectedRef = useRef(false);

  // Fix for drag preview in Wails WebView
  useDragPreviewFix();

  // Create custom schema with bookmark block
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          bookmark: BookmarkBlock(),
        },
      }),
    []
  );

  const editor = useCreateBlockNote({
    schema,
    initialContent:
      initialContent && initialContent.length > 0 ? initialContent : undefined,
    uploadFile: async (file: File): Promise<string> => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (data:image/png;base64,)
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Generate unique filename
      const ext = file.name.split(".").pop() || "png";
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
      slashMenu={false}
      onChange={() => {
        onChange?.(editor.document);
      }}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => {
          const allItems = [...getDefaultReactSlashMenuItems(editor), insertBookmark(editor)];
          if (!query) return allItems;
          const lowerQuery = query.toLowerCase();
          return allItems.filter(
            (item) =>
              item.title.toLowerCase().includes(lowerQuery) ||
              item.aliases?.some((alias: string) => alias.toLowerCase().includes(lowerQuery))
          );
        }}
      />
    </BlockNoteView>
  );
}
