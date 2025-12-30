import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs, Block } from "@blocknote/core";
import { useEffect, useRef, useMemo } from "react";
import { getStrings } from "../constants/strings";
import { useSettings } from "../contexts/SettingsContext";
import { createSmoothCaretPlugin } from "../plugins/smoothCaret";
import { createBookmarkSelectionPlugin } from "../plugins/bookmarkSelection";
import "../plugins/smoothCaret.css";
import { SaveImage } from "../../wailsjs/go/main/App";
import { BookmarkBlock } from "./blocks/BookmarkBlock";
import { useDragPreviewFix } from "../hooks/useDragPreviewFix";
import { EditorTagInput } from "./EditorTagInput";
import {
  createChineseIMEPlugin,
  bookmarkAtomExtension,
  createBookmarkMenuItem,
} from "../utils/editorExtensions";

// Re-export getIsComposing for external use
export { getIsComposing } from "../utils/editorExtensions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InternalEditor = any;

interface EditorProps {
  initialContent?: Block[];
  // onChange 使用 any[] 因为自定义 schema 的 Block 类型与默认 Block 不兼容
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (content: any[]) => void;
  editorRef?: React.MutableRefObject<InternalEditor | null>;
  // Tag props for internal documents
  tags?: string[];
  docId?: string;
  onAddTag?: (docId: string, tag: string) => void;
  onRemoveTag?: (docId: string, tag: string) => void;
  onTagClick?: (tag: string) => void;
  isExternalMode?: boolean;
}

export function Editor({
  initialContent,
  onChange,
  editorRef,
  tags,
  docId,
  onAddTag,
  onRemoveTag,
  onTagClick,
  isExternalMode = false,
}: EditorProps) {
  const { theme, language } = useSettings();
  const STRINGS = useMemo(() => getStrings(language), [language]);
  const pluginInjectedRef = useRef(false);

  // Determine if tags should be shown
  const showTags = !isExternalMode && docId && onAddTag && onRemoveTag;

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
    extensions: [bookmarkAtomExtension],
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

  // Inject plugins after editor is created (only once)
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

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  return (
    <div className="editor-wrapper">
      {showTags && (
        <div className="editor-tags-area">
          <EditorTagInput
            tags={tags || []}
            docId={docId}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onTagClick={onTagClick}
          />
        </div>
      )}
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
            const defaultItems = getDefaultReactSlashMenuItems(editor);
            const customBookmark = createBookmarkMenuItem(editor, STRINGS);

            // Insert custom bookmark item right after other Media group items
            const lastMediaIndex = defaultItems.map(item => item.group).lastIndexOf("Media");
            const allItems = lastMediaIndex >= 0
              ? [...defaultItems.slice(0, lastMediaIndex + 1), customBookmark, ...defaultItems.slice(lastMediaIndex + 1)]
              : [...defaultItems, customBookmark];

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
    </div>
  );
}
