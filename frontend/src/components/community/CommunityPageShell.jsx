import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "../dashboard/DashboardSidebar.jsx";

export default function CommunityPageShell({
  isAuthenticated,
  isSidebarCollapsed,
  onToggleSidebar,
  userName,
  children,
}) {
  const navigate = useNavigate();

  function handleSidebarSectionChange(sectionId) {
    if (!sectionId || sectionId === "community") return;
    navigate("/dashboard", {
      state: { activeSection: sectionId },
    });
  }

  const shellClass = isAuthenticated
    ? (isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:64px_minmax(0,1fr)] [scrollbar-gutter:stable]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:224px_minmax(0,1fr)] [scrollbar-gutter:stable]")
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [scrollbar-gutter:stable]";
  const contentClass = isAuthenticated
    ? (isSidebarCollapsed ? "px-4 py-4 lg:px-6" : "p-5 lg:p-6")
    : "px-4 py-5 md:px-8";

  return (
    <main className={shellClass}>
      {isAuthenticated ? (
        <DashboardSidebar
          activeSection="community"
          isCollapsed={isSidebarCollapsed}
          onSectionChange={handleSidebarSectionChange}
          onToggleCollapse={onToggleSidebar}
          userName={userName}
          newDocumentTo="/library"
          newDocumentLabel="Upload Document"
        />
      ) : null}

      <section className={contentClass}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-5">
          {children}
        </div>
      </section>
    </main>
  );
}
