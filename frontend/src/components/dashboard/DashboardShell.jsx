import React, { useEffect, useState } from "react";
import DashboardSidebar from "./DashboardSidebar.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getDisplayName } from "../../lib/userDisplay.js";

const SIDEBAR_COLLAPSED_KEY = "aiStudyHub.sidebarCollapsed";

export default function DashboardShell({ children }) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const displayName = getDisplayName(user);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // Local storage can be unavailable in restricted browsers.
    }
  }, [isCollapsed]);

  return (
    <main className="flex min-h-[calc(100vh-65px)] bg-[#f8fafc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DashboardSidebar
        avatarUrl={user?.avatarUrl}
        isCollapsed={isCollapsed}
        onLogout={logout}
        onToggleCollapse={() => setIsCollapsed((value) => !value)}
        userName={displayName}
        userPlan={user?.plan}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <section className="grid min-w-0 flex-1 gap-6 px-6 py-6 lg:px-8 lg:py-8">
          {children}
        </section>
      </div>
    </main>
  );
}
