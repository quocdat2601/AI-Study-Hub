import React, { useState } from "react";
import useWorkspaceLayout from "../../hooks/useWorkspaceLayout.js";
import { useWorkspace } from "../../contexts/WorkspaceContext.jsx";
import UploadDocModal from "../../pages/UploadDocModal.jsx";
import WorkspaceChatPanel from "./WorkspaceChatPanel.jsx";
import WorkspaceDocumentViewer from "./WorkspaceDocumentViewer.jsx";
import WorkspaceResizeHandle from "./WorkspaceResizeHandle.jsx";
import WorkspaceSidebar from "./WorkspaceSidebar.jsx";

export default function WorkspaceShell() {
  const { reload, subjects } = useWorkspace();
  const {
    sidebarWidth,
    chatWidth,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    onResizeSidebar,
    onResizeChat,
  } = useWorkspaceLayout();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  function openUpload() {
    setIsUploadOpen(true);
  }

  return (
    <>
      <div className="workspace-theme flex h-screen gap-2 overflow-hidden bg-[#eceef1] p-2 text-sm leading-relaxed text-slate-800">
        <WorkspaceSidebar
          className="workspace-panel"
          collapsed={sidebarCollapsed}
          onNewDocument={openUpload}
          onToggleCollapse={toggleSidebarCollapsed}
          width={sidebarWidth}
        />

        {!sidebarCollapsed ? (
          <WorkspaceResizeHandle label="Resize sidebar" onMouseDown={onResizeSidebar} />
        ) : null}

        <WorkspaceDocumentViewer className="workspace-panel min-w-0 flex-1" />

        <WorkspaceResizeHandle label="Resize chat panel" onMouseDown={onResizeChat} />

        <WorkspaceChatPanel className="workspace-panel" width={chatWidth} />
      </div>

      <UploadDocModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onError={() => {}}
        onSuccess={() => {
          setIsUploadOpen(false);
          reload();
        }}
        subjects={subjects}
      />
    </>
  );
}
