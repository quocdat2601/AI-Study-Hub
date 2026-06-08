import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardSidebar from "./DashboardSidebar.jsx";
import { HelpIcon, SearchIcon } from "./DashboardIcons.jsx";
import NotificationBell from "../NotificationBell.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getDisplayName, getUserInitials } from "../../lib/userDisplay.js";
import useTranslation from "../../hooks/useTranslation.js";

export default function DashboardShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const displayName = getDisplayName(user);
  const initials = getUserInitials(user);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/documents?q=${encodeURIComponent(query)}` : "/documents");
  }

  return (
    <main className="flex min-h-screen bg-[#f8fafc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DashboardSidebar
        avatarUrl={user?.avatarUrl}
        onLogout={logout}
        userName={displayName}
        userPlan={user?.plan}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200/80 bg-[#f8fafc]/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <form className="flex min-w-0 flex-1 items-center" onSubmit={handleSearchSubmit}>
            <label className="relative flex min-w-0 flex-1 items-center">
              <span className="pointer-events-none absolute left-4 text-slate-400">
                <SearchIcon className="h-[18px] w-[18px]" />
              </span>
              <input
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("nav.searchPlaceholder")}
                type="search"
                value={searchQuery}
              />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              aria-label="Help"
              type="button"
            >
              <HelpIcon />
            </button>
            {user?.avatarUrl ? (
              <img alt={displayName} className="h-10 w-10 rounded-full object-cover shadow-[0_8px_18px_rgba(99,102,241,0.28)]" src={user.avatarUrl} title={displayName} />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-[0_8px_18px_rgba(99,102,241,0.28)]"
                title={displayName}
              >
                {initials}
              </span>
            )}
          </div>
        </header>

        <section className="grid min-w-0 flex-1 gap-6 px-6 py-6 lg:px-8 lg:py-8">
          {children}
        </section>
      </div>
    </main>
  );
}
