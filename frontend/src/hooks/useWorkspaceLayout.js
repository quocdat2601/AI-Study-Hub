import { useCallback, useEffect, useState } from "react";

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 340;
const SIDEBAR_DEFAULT = 304;
const CHAT_MIN = 380;
const CHAT_MAX = 520;
const CHAT_DEFAULT = 420;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function useWorkspaceLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const onResizeSidebar = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(moveEvent) {
      setSidebarWidth(clamp(startWidth + (moveEvent.clientX - startX), SIDEBAR_MIN, SIDEBAR_MAX));
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const onResizeChat = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = chatWidth;

    function onMouseMove(moveEvent) {
      setChatWidth(clamp(startWidth - (moveEvent.clientX - startX), CHAT_MIN, CHAT_MAX));
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [chatWidth]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((value) => !value);
  }, []);

  return {
    sidebarWidth,
    chatWidth,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    onResizeSidebar,
    onResizeChat,
  };
}
