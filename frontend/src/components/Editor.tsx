import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenu,
  SideMenuController,
  FormattingToolbarController,
} from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs, Block } from "@blocknote/core";
import { useEffect, useRef, useMemo } from "react";
import { getStrings } from "../constants/strings";
import { useSettings } from "../contexts/SettingsContext";
import { createSmoothCaretPlugin } from "../plugins/smoothCaret";
import { createBookmarkSelectionPlugin } from "../plugins/bookmarkSelection";
import { PasteLinkMenu } from "./PasteLinkMenu";
import "../plugins/smoothCaret.css";
import { OpenFileDialog, SelectFolderDialog } from "../../wailsjs/go/main/App";
import { BookmarkBlock } from "./blocks/BookmarkBlock";
import { FileBlock } from "./blocks/FileBlock";
import { FolderBlock } from "./blocks/FolderBlock";
import { useDragPreviewFix } from "../hooks/useDragPreviewFix";
import { EditorTagInput } from "./EditorTagInput";
import {
  createChineseIMEPlugin,
  bookmarkAtomExtension,
  createBookmarkMenuItem,
  createFileMenuItem,
  createFolderMenuItem,
} from "../utils/editorExtensions";
import { useImageUpload } from "../hooks/useImageUpload";
import { usePasteHandler } from "../hooks/usePasteHandler";
import { useFileDrop } from "../hooks/useFileDrop";
import { CustomDragHandleMenu } from "./CustomDragHandleMenu";
import { CustomFormattingToolbar } from "./CustomFormattingToolbar";

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

  // Ref for editor container to attach paste listener
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Hook for image upload
  const { uploadFile } = useImageUpload();

  // Create custom schema with bookmark block
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          bookmark: BookmarkBlock(),
          file: FileBlock(),
          folder: FolderBlock(),
        },
      }),
    []
  );

  const editor = useCreateBlockNote({
    schema,
    extensions: [bookmarkAtomExtension],
    initialContent:
      initialContent && initialContent.length > 0 ? initialContent : undefined,
    uploadFile: uploadFile,
  });

  // Hook for paste handling (Links, Bookmarks)
  const {
    pasteLinkState,
    handleDismissPasteMenu,
    handlePasteAsLink,
    handleCreateBookmark
  } = usePasteHandler({
    editor,
    containerRef: editorContainerRef,
  });

  // Hook for file drop handling (Wails events)
  useFileDrop({
    editor,
    docId,
  });

  useEffect(() => {
    const container = editorContainerRef.current;
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
  }, []);

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

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  return (
    <div className="editor-wrapper" ref={editorContainerRef}>
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
        sideMenu={false}
        formattingToolbar={false}
        onChange={() => {
          onChange?.(editor.document);
        }}
      >
        <FormattingToolbarController formattingToolbar={CustomFormattingToolbar} />
        <SideMenuController
          sideMenu={(props) => (
            <SideMenu {...props} dragHandleMenu={CustomDragHandleMenu} />
          )}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaultItems = getDefaultReactSlashMenuItems(editor);
            const customBookmark = createBookmarkMenuItem(editor, STRINGS);
            const customFile = createFileMenuItem(editor, STRINGS, async () => {
              const fileInfo = await OpenFileDialog();
              return fileInfo || null;
            }, () => docId);
            const customFolder = createFolderMenuItem(editor, STRINGS, async () => {
              const path = await SelectFolderDialog();
              return path || null;
            }, () => docId);

            // Insert custom items right after other Media group items
            const lastMediaIndex = defaultItems.map(item => item.group).lastIndexOf("Media");
            const allItems = lastMediaIndex >= 0
              ? [...defaultItems.slice(0, lastMediaIndex + 1), customBookmark, customFile, customFolder, ...defaultItems.slice(lastMediaIndex + 1)]
              : [...defaultItems, customBookmark, customFile, customFolder];

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
      {pasteLinkState && (
        <PasteLinkMenu
          url={pasteLinkState.url}
          position={pasteLinkState.position}
          onPasteAsText={handlePasteAsLink}
          onCreateBookmark={handleCreateBookmark}
          onDismiss={handleDismissPasteMenu}
          language={language}
        />
      )}
    </div>
  );
}
