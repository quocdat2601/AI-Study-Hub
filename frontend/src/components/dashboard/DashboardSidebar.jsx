import React from "react";
import { Link, useLocation } from "react-router-dom";
import useTranslation from "../../hooks/useTranslation.js";

export const dashboardSidebarItems = [
  { id: "dashboard", icon: "dashboard", labelKey: "nav.dashboard", path: "/dashboard" },
  { id: "study-sets", icon: "book", labelKey: "nav.studySets", path: "/dashboard" },
  { id: "documents", icon: "document", labelKey: "nav.documents", path: "/documents" },
  { id: "ai-workspace", icon: "chat", labelKey: "nav.aiWorkspace", path: "/ai-workspace" },
  { id: "analytics", icon: "analytics", labelKey: "nav.analytics", path: "/dashboard" },
];

function SidebarIcon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5C5.6 4.6 7.2 4.2 9 4.2c1.1 0 2.1.2 3 .7v14c-.9-.5-1.9-.7-3-.7-1.8 0-3.4.4-5 1.3v-14Z" />
        <path d="M12 4.9c.9-.5 1.9-.7 3-.7 1.8 0 3.4.4 5 1.3v14c-1.6-.9-3.2-1.3-5-1.3-1.1 0-2.1.2-3 .7" />
      </>
    ),
    document: (
      <>
        <path d="M6 3.5h8l4 4v13H6v-17Z" />
        <path d="M14 3.5v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </>
    ),
    chat: (
      <>
        <path d="M4 5h16v10H9l-5 4V5Z" />
        <path d="M8 9h8" />
        <path d="M8 12h5" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 16l4-4 3 3 6-8" />
        <path d="M17 7h3v3" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
        <path d="M19.4 15a8.3 8.3 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a8.8 8.8 0 0 0-1.7-1L15 6.5h-4L10.6 9a8.8 8.8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8.3 8.3 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8.8 8.8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8.8 8.8 0 0 0 1.7-1l2.4 1 2-3.5-2.2-1.5Z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  };

  return (
    <svg className="h-5 w-5 shrink-0 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function navItemClass(isActive) {
  return isActive
    ? "relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-indigo-50 px-3 text-left text-[13px] font-semibold text-indigo-700 no-underline transition before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
    : "flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-medium text-slate-600 no-underline transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";
}

function isNavItemActive(pathname, item) {
  if (item.id === "dashboard") return pathname === "/dashboard";
  if (item.id === "documents") return pathname.startsWith("/documents");
  if (item.id === "ai-workspace") return pathname.startsWith("/ai-workspace");
  return false;
}

export default function DashboardSidebar({ onLogout, userName, userPlan, avatarUrl }) {
  const pathname = useLocation().pathname;
  const { t } = useTranslation();

  return (
    <aside
      className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950"
      aria-label="Dashboard navigation"
    >
      <Link className="mb-6 flex items-center gap-3 no-underline" to="/dashboard">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.28)]">
          A
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100">AI Study Hub</strong>
          <small className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">Academic Pro</small>
        </span>
      </Link>

      <Link
        className="mb-6 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white no-underline shadow-[0_10px_24px_rgba(79,70,229,0.24)] transition hover:bg-indigo-700 active:scale-[0.98]"
        to="/documents?upload=true"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        <span>{t("nav.newDocument")}</span>
      </Link>

      <nav className="grid content-start gap-1">
        {dashboardSidebarItems.map((item) => (
          <Link
            className={navItemClass(isNavItemActive(pathname, item))}
            key={item.id}
            to={item.path}
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center">
              <SidebarIcon name={item.icon} />
            </span>
            <span className="truncate">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto grid gap-1 border-t border-slate-100 pt-4 dark:border-slate-800">
        {userName ? (
          <div className="mb-2 flex items-center gap-2 px-3 py-1">
            {avatarUrl ? (
              <img alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" src={avatarUrl} />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <strong className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{userName}</strong>
              <small className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{userPlan || "Student Plan"}</small>
            </span>
          </div>
        ) : null}

        <Link className={navItemClass(pathname === "/account")} to="/account">
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <SidebarIcon name="settings" />
          </span>
          <span className="truncate">{t("nav.settings")}</span>
        </Link>

        <button
          className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          onClick={onLogout}
          type="button"
        >
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <SidebarIcon name="logout" />
          </span>
          <span className="truncate">{t("nav.logout")}</span>
        </button>
      </div>
    </aside>
  );
}
