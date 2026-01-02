
import { Sidebar } from "./Sidebar";
import { ExternalFileInfo } from "../contexts/ExternalFileContext";
import type { DocumentSearchResult } from "../types/document";

interface RelatedViewState {
  sourceContent: string;
  results: DocumentSearchResult[];
  isLoading: boolean;
}

interface SidebarContainerProps {
  // 外部文件
  externalFiles: ExternalFileInfo[];
  activeExternalPath: string | null;

  // 侧边栏状态
  collapsed: boolean;

  // 回调
  onSelectInternal: (id: string, blockId?: string) => void;
  onSelectExternal: (path: string) => void;
  onCloseExternal: (path: string) => void;

  // 相关文档视图
  relatedView?: RelatedViewState | null;
  onExitRelatedView?: () => void;
}

export function SidebarContainer({
  externalFiles,
  activeExternalPath,
  collapsed,
  onSelectInternal,
  onSelectExternal,
  onCloseExternal,
  relatedView,
  onExitRelatedView,
}: SidebarContainerProps) {
  return (
    <div className={`sidebar-wrapper ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        externalFiles={externalFiles}
        activeExternalPath={activeExternalPath}
        onSelectExternal={onSelectExternal}
        onCloseExternal={onCloseExternal}
        collapsed={collapsed}
        onSelectInternal={onSelectInternal}
        relatedView={relatedView}
        onExitRelatedView={onExitRelatedView}
      />
    </div>
  );
}
