import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs, createExtension } from "@blocknote/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
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

/**
 * Module-level state to track Chinese IME composition.
 * Used to prevent slash menu from triggering during IME input.
 */
let isComposing = false;

const chineseIMEPluginKey = new PluginKey("chineseIMEFix");

/**
 * ProseMirror plugin to fix Chinese IME breaking slash menu.
 * Tracks composition state and closes the suggestion menu if triggered during composition.
 */
function createChineseIMEPlugin(editor: any) {
  return new Plugin({
    key: chineseIMEPluginKey,
    props: {
      handleDOMEvents: {
        compositionstart: () => {
          isComposing = true;
          return false;
        },
        compositionend: () => {
          // Use setTimeout to ensure compositionend fires after the last input event
          setTimeout(() => {
            isComposing = false;
          }, 0);
          return false;
        },
      },
    },
    view: () => ({
      update: () => {
        // If we're composing and the suggestion menu is shown, close it
        if (isComposing) {
          try {
            // Access BlockNote's internal suggestion menu state
            const suggestionMenuExt = editor._extensions?.suggestionMenu;
            if (suggestionMenuExt?.shown?.()) {
              suggestionMenuExt.closeMenu?.();
            }
          } catch {
            // Silently ignore if we can't access the menu
          }
        }
      },
      destroy: () => { },
    }),
  });
}

// Export composition state getter for external use
export function getIsComposing(): boolean {
  return isComposing;
}

// TipTap extension to make bookmark node atomic (prevents selecting internal content)
const BookmarkAtomTiptapExtension = Extension.create({
  name: "bookmarkAtom",
  extendNodeSchema(extension) {
    // Only set atom: true for the bookmark node type
    if (extension.name === "bookmark") {
      return { atom: true };
    }
    return {};
  },
});

// BlockNote extension wrapper for the TipTap extension
const bookmarkAtomExtension = createExtension({
  key: "bookmarkAtom",
  tiptapExtensions: [BookmarkAtomTiptapExtension],
});

interface EditorProps {
  initialContent?: any[];
  onChange?: (content: any[]) => void;
  editorRef?: React.MutableRefObject<any>;
  // Tag props for internal documents
  tags?: string[];
  docId?: string;
  onAddTag?: (docId: string, tag: string) => void;
  onRemoveTag?: (docId: string, tag: string) => void;
  onTagClick?: (tag: string) => void;
  isExternalMode?: boolean;
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
const insertBookmark = (editor: any, STRINGS: any) => ({
  title: STRINGS.LABELS.EXTERNAL_FILE,
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
  subtext: STRINGS.TOOLTIPS.OPEN_FILE,
});

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

  // Inject smooth caret plugin after editor is created (only once)
  // Also set bookmark node's atom property to true
  useEffect(() => {
    if (editor && editor._tiptapEditor && !pluginInjectedRef.current) {
      // Access the ProseMirror view and register the plugin
      const view = editor._tiptapEditor.view;
      if (view) {
        try {
          // Set bookmark node as atomic to prevent selecting internal content
          const bookmarkNodeType = view.state.schema.nodes.bookmark;
          if (bookmarkNodeType) {
            // Directly modify the node type spec to make it atomic
            (bookmarkNodeType.spec as any).atom = true;
          }

          // Create plugin instance
          const smoothCaretPlugin = createSmoothCaretPlugin({
            transitionDuration: 60,
            cursorWidth: 2,
            enableBlink: true,
          });

          // Create bookmark selection plugin
          const bookmarkSelectionPlugin = createBookmarkSelectionPlugin();

          // Create Chinese IME fix plugin (prevents slash menu during composition)
          const chineseIMEPlugin = createChineseIMEPlugin(editor);

          // Add plugins to the editor's state
          const { state } = view;
          const newState = state.reconfigure({
            plugins: [...state.plugins, smoothCaretPlugin, bookmarkSelectionPlugin, chineseIMEPlugin],
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
            const allItems = [...getDefaultReactSlashMenuItems(editor), insertBookmark(editor, STRINGS)];
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
