import React from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "../dashboard/DashboardSidebar.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getDisplayName } from "../../lib/userDisplay.js";

export default function CommunityPageShell({
  isAuthenticated,
  children,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const displayName = getDisplayName(user);

  const shellClass = isAuthenticated
    ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:248px_minmax(0,1fr)] [scrollbar-gutter:stable]"
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [scrollbar-gutter:stable]";
  const contentClass = isAuthenticated
    ? "p-5 lg:p-6"
    : "px-4 py-5 md:px-8";

  return (
    <main className={shellClass}>
      {isAuthenticated ? (
        <DashboardSidebar
          avatarUrl={user?.avatarUrl}
          onLogout={handleLogout}
          userName={displayName}
          userPlan={user?.plan}
          className="sticky top-16 flex h-[calc(100vh-64px)] w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950"
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
