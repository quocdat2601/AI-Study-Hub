import React from "react";
import useWorkspace from "../hooks/useWorkspace.js";
import WorkspaceErrorBoundary from "../components/workspace/WorkspaceErrorBoundary.jsx";
import WorkspaceShell from "../components/workspace/WorkspaceShell.jsx";

/** Trang Workspace chính — sidebar + PDF + Ask AI. */
export default function WorkspacePage() {
  const workspace = useWorkspace();

  return (
    <WorkspaceErrorBoundary>
      <div className="workspace-theme relative flex h-screen flex-col overflow-hidden bg-[var(--bg-base)] text-[15px] leading-normal font-[Inter,system-ui,sans-serif] text-[var(--text-primary)]">
        <WorkspaceShell {...workspace} />
      </div>
    </WorkspaceErrorBoundary>
  );
}
