import { useMemo } from "react";
import { Editor } from "./Editor";
import { Header } from "../common/Header";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { DocumentMeta } from "../../types/document";
import { getStrings } from "../../constants/strings";
import { useSettings } from "../../contexts/SettingsContext";
import { ExternalFileInfo } from "../../contexts/ExternalFileContext";

interface EditorContainerProps {
  // 编辑器状态
  content: Block[] | undefined;
  editorKey: string | null;
  editorRef: React.MutableRefObject<BlockNoteEditor | null>;
  editorAnimating: boolean;
  contentLoading: boolean;
  isLoading: boolean;

  // 文档信息
  documents: DocumentMeta[];
  activeId: string | null;
  activeDoc: DocumentMeta | undefined;

  // 外部文件
  isExternalMode: boolean;
  activeExternalFile: ExternalFileInfo | null;

  // 标题显示
  isH1Visible: boolean;
  status: string;

  // 回调
  onChange: (blocks: Block[]) => void;
  onAddTag: (docId: string, tag: string) => Promise<void>;
  onRemoveTag: (docId: string, tag: string) => Promise<void>;
  onTagClick: (tag: string | null) => void;
  onCreateDoc: () => void;
}

export function EditorContainer({
  content,
  editorKey,
  editorRef,
  editorAnimating,
  contentLoading,
  isLoading,

  activeId,
  activeDoc,
  isExternalMode,
  activeExternalFile,
  isH1Visible,
  status,
  onChange,
  onAddTag,
  onRemoveTag,
  onTagClick,
  onCreateDoc,
}: EditorContainerProps) {
  const { language } = useSettings();
  const STRINGS = useMemo(() => getStrings(language), [language]);

  // 当前文档标题
  const currentTitle = useMemo(() => {
    if (isExternalMode) {
      return activeExternalFile?.name || STRINGS.LABELS.EXTERNAL_FILE;
    }
    return activeDoc?.title || "";
  }, [isExternalMode, activeExternalFile?.name, activeDoc?.title, STRINGS.LABELS.EXTERNAL_FILE]);

  // 是否显示标题
  const showTitle = !isH1Visible && !editorAnimating && !contentLoading;

  return (
    <div className="main-content">
      <Header
        title={currentTitle}
        status={status}
        showTitle={showTitle}
      />
      <main className="editor-container">
        {isLoading || contentLoading ? (
          <div className="loading">{STRINGS.STATUS.LOADING}</div>
        ) : editorKey ? (
          <div className={editorAnimating ? "editor-fade-exit" : "editor-fade-enter"}>
            <Editor
              key={editorKey}
              initialContent={content}
              onChange={onChange}
              editorRef={editorRef}
              tags={activeDoc?.tags}
              docId={activeId || undefined}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onTagClick={onTagClick}
              isExternalMode={isExternalMode}
            />
          </div>
        ) : (
          <div className="empty-state">
            <p>{STRINGS.LABELS.EMPTY_APP}</p>
            <button onClick={onCreateDoc}>{STRINGS.BUTTONS.CREATE_DOC}</button>
          </div>
        )}
      </main>
    </div>
  );
}
