import React, { useState } from "react";
import WorkspaceSidebar from "./WorkspaceSidebar.jsx";
import DocumentViewer from "./DocumentViewer.jsx";
import ChatPanel from "./ChatPanel.jsx";
import PanelResizer from "./PanelResizer.jsx";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function WorkspaceShell(props) {
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [chatWidth, setChatWidth] = useState(420);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
        <WorkspaceSidebar {...props} />
      </div>

      <PanelResizer onResize={(delta) => setSidebarWidth((w) => clamp(w + delta, 280, 440))} />

      <DocumentViewer {...props} />

      <PanelResizer onResize={(delta) => setChatWidth((w) => clamp(w - delta, 340, 540))} />

      <div className="shrink-0 overflow-hidden" style={{ width: chatWidth }}>
        <ChatPanel {...props} />
      </div>
    </div>
  );
}
