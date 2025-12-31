
import { Sidebar } from "./Sidebar";
import { ExternalFileInfo } from "../contexts/ExternalFileContext";


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
}

export function SidebarContainer({
  externalFiles,
  activeExternalPath,
  collapsed,
  onSelectInternal,
  onSelectExternal,
  onCloseExternal,
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
      />
    </div>
  );
}
