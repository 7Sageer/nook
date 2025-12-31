import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs, Block } from "@blocknote/core";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { getStrings } from "../constants/strings";
import { useSettings } from "../contexts/SettingsContext";
import { createSmoothCaretPlugin } from "../plugins/smoothCaret";
import { createBookmarkSelectionPlugin } from "../plugins/bookmarkSelection";
import { isValidUrl, PasteLinkState } from "../plugins/pasteLink";
import { PasteLinkMenu } from "./PasteLinkMenu";
import "../plugins/smoothCaret.css";
import { SaveImage, OpenFileDialog, SaveFile, IndexFileContent } from "../../wailsjs/go/main/App";
import { BookmarkBlock } from "./blocks/BookmarkBlock";
import { FileBlock } from "./blocks/FileBlock";
import { useDragPreviewFix } from "../hooks/useDragPreviewFix";
import { EditorTagInput } from "./EditorTagInput";
import {
  createChineseIMEPlugin,
  bookmarkAtomExtension,
  createBookmarkMenuItem,
  createFileMenuItem,
  insertBookmarkWithUrl,
  insertFileBlock,
  fileToBase64,
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

  // 粘贴链接菜单状态
  const [pasteLinkState, setPasteLinkState] = useState<PasteLinkState | null>(null);

  // Ref for editor container to attach paste listener
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 关闭菜单
  const handleDismissPasteMenu = useCallback(() => {
    setPasteLinkState(null);
  }, []);

  // Create custom schema with bookmark block
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          bookmark: BookmarkBlock(),
          file: FileBlock(),
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

  // 粘贴为链接文本
  const handlePasteAsLink = useCallback(() => {
    if (!pasteLinkState || !editor) return;

    editor.insertInlineContent([
      {
        type: "link",
        href: pasteLinkState.url,
        content: pasteLinkState.url,
      },
    ]);

    setPasteLinkState(null);
  }, [pasteLinkState, editor]);

  // 创建书签
  const handleCreateBookmark = useCallback(() => {
    if (!pasteLinkState || !editor) return;

    insertBookmarkWithUrl(editor, pasteLinkState.url);
    setPasteLinkState(null);
  }, [pasteLinkState, editor]);

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

  // DOM-level paste event listener to capture real clipboard data
  // TipTap/BlockNote creates synthetic events without clipboardData, so we need to listen at DOM level
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !editor) return;

    const handlePaste = (event: ClipboardEvent) => {
      // Skip if pasting into bookmark input field - let the URL paste directly
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.closest('.bookmark-input')) {
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const text = clipboardData.getData('text/plain').trim();
      if (!isValidUrl(text)) return;

      // Prevent default paste behavior for URLs
      event.preventDefault();
      event.stopPropagation();

      // Get cursor position from the editor
      try {
        const view = editor._tiptapEditor?.view;
        if (view) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setPasteLinkState({
            url: text,
            position: { x: coords.left, y: coords.bottom + 4 },
            cursorPos: from,
          });
        }
      } catch {
        // Fallback: show menu at default position
        setPasteLinkState({
          url: text,
          position: { x: 200, y: 200 },
          cursorPos: 0,
        });
      }
    };

    // Use capture phase to intercept before TipTap processes
    container.addEventListener('paste', handlePaste, { capture: true });

    return () => {
      container.removeEventListener('paste', handlePaste, { capture: true });
    };
  }, [editor]);

  // File drop event listener for FileBlock
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !editor) return;

    const handleDrop = async (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();

      // Only handle supported file types
      if (!['md', 'txt', 'pdf', 'docx', 'html', 'htm'].includes(ext || '')) {
        return; // Let default handler process (e.g., images)
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        const base64 = await fileToBase64(file);
        const fileInfo = await SaveFile(base64, file.name);

        if (fileInfo) {
          const block = insertFileBlock(editor, fileInfo);
          // Trigger async indexing (don't await)
          IndexFileContent(fileInfo.filePath, docId || '', block.id).catch(() => {
            // Silently ignore indexing errors
          });
        }
      } catch (err) {
        console.error('Failed to handle file drop:', err);
      }
    };

    // Use capture phase to intercept before BlockNote/TipTap processes
    container.addEventListener('drop', handleDrop, { capture: true });
    return () => container.removeEventListener('drop', handleDrop, { capture: true });
  }, [editor, docId]);

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
        onChange={() => {
          onChange?.(editor.document);
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaultItems = getDefaultReactSlashMenuItems(editor);
            const customBookmark = createBookmarkMenuItem(editor, STRINGS);
            const customFile = createFileMenuItem(editor, STRINGS, async () => {
              const fileInfo = await OpenFileDialog();
              return fileInfo || null;
            });

            // Insert custom items right after other Media group items
            const lastMediaIndex = defaultItems.map(item => item.group).lastIndexOf("Media");
            const allItems = lastMediaIndex >= 0
              ? [...defaultItems.slice(0, lastMediaIndex + 1), customBookmark, customFile, ...defaultItems.slice(lastMediaIndex + 1)]
              : [...defaultItems, customBookmark, customFile];

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
