import { useCallback, useEffect, useState } from "react";

const SIDEBAR_MIN_VW = 15;
const SIDEBAR_MAX_VW = 40;
const SIDEBAR_DEFAULT_VW = 20;

const CHAT_MIN_VW = 20;
const CHAT_MAX_VW = 50;
const CHAT_DEFAULT_VW = 30;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function useWorkspaceLayout() {
  const [sidebarVw, setSidebarVw] = useState(SIDEBAR_DEFAULT_VW);
  const [chatVw, setChatVw] = useState(CHAT_DEFAULT_VW);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const onResizeSidebar = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startVw = sidebarVw;

    function onMouseMove(moveEvent) {
      const vw = window.innerWidth;
      const deltaPx = moveEvent.clientX - startX;
      const deltaVw = (deltaPx / vw) * 100;
      setSidebarVw(clamp(startVw + deltaVw, SIDEBAR_MIN_VW, SIDEBAR_MAX_VW));
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
  }, [sidebarVw]);

  const onResizeChat = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startVw = chatVw;

    function onMouseMove(moveEvent) {
      const vw = window.innerWidth;
      const deltaPx = moveEvent.clientX - startX;
      const deltaVw = (deltaPx / vw) * 100;
      // Chat is on the right, so moving left (negative deltaPx) increases width
      setChatVw(clamp(startVw - deltaVw, CHAT_MIN_VW, CHAT_MAX_VW));
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
  }, [chatVw]);

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
    sidebarWidth: `${sidebarVw}vw`,
    chatWidth: `${chatVw}vw`,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    onResizeSidebar,
    onResizeChat,
  };
}
