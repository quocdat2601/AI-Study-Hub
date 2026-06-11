import React from "react";
import WorkspaceShell from "../components/workspace/WorkspaceShell.jsx";
import { WorkspaceProvider } from "../contexts/WorkspaceContext.jsx";

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}
