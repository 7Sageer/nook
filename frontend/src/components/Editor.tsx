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
import { PasteLinkMenu } from "./PasteLinkMenu";
import "../plugins/smoothCaret.css";
import { OpenFileDialog, SelectFolderDialog } from "../../wailsjs/go/main/App";
import { BookmarkBlock } from "./blocks/BookmarkBlock";
import { FileBlock } from "./blocks/FileBlock";
import { FolderBlock } from "./blocks/FolderBlock";
import { useDragPreviewFix } from "../hooks/useDragPreviewFix";
import { EditorTagInput } from "./EditorTagInput";
import {
  bookmarkAtomExtension,
  createBookmarkMenuItem,
  createFileMenuItem,
  createFolderMenuItem,
} from "../utils/editorExtensions";
import { useImageUpload } from "../hooks/useImageUpload";
import { usePasteHandler } from "../hooks/usePasteHandler";
import { CustomDragHandleMenu } from "./CustomDragHandleMenu";
import { CustomFormattingToolbar } from "./CustomFormattingToolbar";
import { useEditorPlugins } from "../hooks/useEditorPlugins";
import { useEditorFileHandling } from "../hooks/useEditorFileHandling";

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

  // Decoupled hooks
  useEditorFileHandling({
    editor,
    docId,
    containerRef: editorContainerRef,
  });

  useEditorPlugins(editor);

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
