import { useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { EventsEmit, EventsOn } from '../../wailsjs/runtime/runtime';
import { Block, BlockNoteEditor } from '@blocknote/core';
import { ExternalFileInfo } from '../contexts/ExternalFileContext';

interface UseAppEventsOptions {
  // 外部文件操作
  openExternalByPath: (path: string, content: string) => void;
  saveExternal: (content: string) => Promise<void>;
  isExternalMode: boolean;
  activeExternalFile: ExternalFileInfo | null;

  // 编辑器操作
  editorRef: React.MutableRefObject<BlockNoteEditor | null>;
  parseMarkdownToBlocks: (markdown: string) => Promise<Block[]>;
  setContent: (blocks: Block[]) => void;
  setContentLoading: (loading: boolean) => void;
  setEditorKey: (key: string) => void;

  // 文档操作
  activeId: string | null;
  saveContent: (id: string, content: Block[]) => Promise<void>;
  syncTitleFromBlocks: (blocks: Block[]) => void;

  // 脏标记操作（跟踪未保存更改）
  markDirty: () => void;
  clearDirty: () => void;

  // 状态回调
  setStatus: (status: string) => void;
  statusSavedText: string;
}

export function useAppEvents({
  openExternalByPath,
  saveExternal,
  isExternalMode,
  activeExternalFile,
  editorRef,
  parseMarkdownToBlocks,
  setContent,
  setContentLoading,
  setEditorKey,
  activeId,
  saveContent,
  syncTitleFromBlocks,
  markDirty,
  clearDirty,
  setStatus,
  statusSavedText,
}: UseAppEventsOptions) {

  // 监听系统文件打开事件（macOS Finder 双击打开）
  useEffect(() => {
    const unsubscribe = EventsOn('file:open-external', async (filePath: string) => {
      setContentLoading(true);
      try {
        const { LoadExternalFile } = await import('../../wailsjs/go/main/App');
        const fileContent = await LoadExternalFile(filePath);

        openExternalByPath(filePath, fileContent);

        const blocks = await parseMarkdownToBlocks(fileContent);
        setContent(blocks);
        setEditorKey(`external-${filePath}`);
      } catch (e) {
        console.error('打开文件失败:', e);
      } finally {
        setContentLoading(false);
      }
    });

    // 通知后端：前端已注册文件打开事件监听器
    EventsEmit('app:frontend-ready');

    return () => unsubscribe();
  }, [openExternalByPath, parseMarkdownToBlocks, setContent, setContentLoading, setEditorKey]);

  // 内部文档保存逻辑（抽离出来以便防抖）
  const debouncedSaveInternal = useDebounce(async (id: string, blocks: Block[]) => {
    await saveContent(id, blocks);
    clearDirty();  // 保存成功后清除脏标记
    setStatus(statusSavedText);
    setTimeout(() => setStatus(""), 1000);
  }, 800);

  // 外部文件保存逻辑（抽离出来以便防抖）
  const debouncedSaveExternal = useDebounce(async (content: string) => {
    await saveExternal(content);
    clearDirty();  // 保存成功后清除脏标记
    setStatus(statusSavedText);
    setTimeout(() => setStatus(""), 1000);
  }, 800);

  // 保存文档的处理函数
  const handleChange = useCallback(async (blocks: Block[]) => {
    // 标记有未保存更改
    markDirty();

    if (isExternalMode && activeExternalFile && editorRef.current) {
      // 保存外部文件 - 防抖
      try {
        const markdown = await editorRef.current.blocksToMarkdownLossy();
        debouncedSaveExternal(markdown);
      } catch (e) {
        console.error('保存外部文件失败:', e);
      }
    } else if (activeId) {
      // 保存内部文档 - 防抖
      debouncedSaveInternal(activeId, blocks);

      // 自动同步 H1 标题 - 保持实时（它是内存操作，不涉及 I/O）
      syncTitleFromBlocks(blocks);
    }
  }, [
    markDirty,
    isExternalMode,
    activeExternalFile,
    editorRef,
    debouncedSaveExternal,
    activeId,
    debouncedSaveInternal,
    syncTitleFromBlocks,
  ]);

  return {
    handleChange,
  };
}
