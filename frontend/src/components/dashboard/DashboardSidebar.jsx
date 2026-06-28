import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useUploadDocModal } from "../../contexts/UploadDocContext.jsx";
import useTranslation from "../../hooks/useTranslation.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export const dashboardSidebarItems = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard", labelKey: "nav.dashboard", to: "/dashboard" },
  { id: "study-sets", icon: "book", label: "Study Sets", labelKey: "nav.studySets", to: "/library" },
  { id: "documents", icon: "document", label: "Documents", labelKey: "nav.documents", to: "/documents" },
  { id: "study-resources", icon: "compass", label: "Explore Docs", labelKey: "nav.studyResources", to: "/public-documents" },
  { id: "ai-workspace", icon: "chat", label: "AI Workspace", labelKey: "nav.aiWorkspace", to: "/workspace" },
  ...(String(import.meta.env.VITE_CHAT_SNAPSHOT_SHARING_ENABLED || "false") === "true" ? [
    { id: "shared", icon: "compass", label: "Shared", to: "/shared" },
  ] : []),
  { id: "analytics", icon: "analytics", label: "Analytics", labelKey: "nav.analytics", to: "/dashboard" },
];

function SidebarIcon({ name }) {
  const icons = {
    dashboard: (
      <>
        <path d="M4 11h7V4H4v7Z" />
        <path d="M13 4h7v5h-7V4Z" />
        <path d="M13 11h7v9h-7v-9Z" />
        <path d="M4 14h7v6H4v-6Z" />
      </>
    ),
    book: (
      <>
        <path d="M6 4.5h11a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2V6.5a2 2 0 0 1 2-2Z" />
        <path d="M8 8h8" />
        <path d="M8 11h6" />
      </>
    ),
    document: (
      <>
        <path d="M7 3.5h7l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
        <path d="M14 3.5v4h4" />
        <path d="M8 11h8" />
        <path d="M8 15h6" />
      </>
    ),
    community: (
      <>
        <path d="M7.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M16.5 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M4 18c.4-2.4 1.9-3.7 4.5-3.7S12.6 15.6 13 18" />
        <path d="M13.5 17.5c.4-1.9 1.7-3 3.8-3 1.8 0 3 .9 3.4 2.8" />
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
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12h2M3 12h2M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17H6.5A1.5 1.5 0 0 1 5 15.5v-7A1.5 1.5 0 0 1 6.5 7H10" />
        <path d="M14 9l3 3-3 3" />
        <path d="M17 12H9" />
      </>
    ),
    users: (
      <>
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M3 19c.5-3 2.2-4.5 5-4.5s4.5 1.5 5 4.5" />
        <path d="M16 11.5a2.5 2.5 0 1 0 0-5" />
        <path d="M15.5 15c2 .2 3.2 1.5 3.5 4" />
      </>
    ),
    reports: (
      <>
        <path d="M7 3.5h10l3 3V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
        <path d="M10 9h4" />
        <path d="M10 13h4" />
        <path d="M10 17h2" />
      </>
    ),
    activity: (
      <>
        <path d="M4 12h3l2-5 4 10 2-5h5" />
      </>
    ),
    doc: (
      <>
        <path d="M6 3.5h8l4 4v13H6v-17Z" />
        <path d="M14 3.5v4h4" />
        <path d="M9 13h6" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </>
    ),
  };

  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function navItemClass(isCollapsed, isActive) {
  if (isCollapsed) {
    return isActive
      ? "flex h-10 w-full items-center justify-center rounded-md border-0 bg-[#d5e3fc] text-[#344154] no-underline transition"
      : "flex h-10 w-full items-center justify-center rounded-md border-0 bg-transparent text-[#344154] no-underline transition hover:bg-white";
  }

  return isActive
    ? "no-caret relative flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-indigo-50 px-3 text-left text-[13px] font-semibold text-indigo-700 no-underline transition before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
    : "no-caret flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-medium text-slate-600 no-underline transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";
}

function isPathActive(pathname, targetPath) {
  if (!targetPath) return false;
  if (targetPath === "/") return pathname === "/";
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function getInitials(userName) {
  return String(userName || "User").slice(0, 2).toUpperCase();
}

function DefaultSidebar({
  onLogout,
  userName,
  userPlan,
  avatarUrl,
  className,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openUpload } = useUploadDocModal();
  const pathname = useLocation().pathname;

  return (
    <aside
      className={className || "sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950"}
      aria-label="Dashboard navigation"
    >
      <button
        className="no-caret mb-5 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)] transition hover:bg-indigo-700 active:scale-[0.98]"
        onClick={() => openUpload()}
        type="button"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        <span>{t("nav.newDocument")}</span>
      </button>

      <nav className="grid content-start gap-1">
        {dashboardSidebarItems.map((item) => (
          <Link
            className={navItemClass(false, isPathActive(pathname, item.to))}
            key={item.id}
            to={item.to || "/dashboard"}
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center">
              <SidebarIcon name={item.icon} />
            </span>
            <span className="truncate">{t(item.labelKey || item.id)}</span>
          </Link>
        ))}
        {user?.role === "admin" ? (
          <Link
            className="no-caret flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-bold text-indigo-600 no-underline transition hover:bg-slate-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-slate-800"
            to="/admin"
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center">
              <SidebarIcon name="users" />
            </span>
            <span className="truncate">Admin Panel</span>
          </Link>
        ) : null}
      </nav>

      <div className="mt-auto grid gap-1 border-t border-slate-100 pt-4 dark:border-slate-800">
        {userName ? (
          <div className="mb-2 flex items-center gap-2 px-3 py-1">
            {avatarUrl ? (
              <img alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" src={avatarUrl} />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {getInitials(userName)}
              </span>
            )}
            <span className="min-w-0">
              <strong className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{userName}</strong>
              <small className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{userPlan || "Student Plan"}</small>
            </span>
          </div>
        ) : null}

        <Link className={navItemClass(false, pathname === "/account")} to="/account">
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <SidebarIcon name="settings" />
          </span>
          <span className="truncate">{t("nav.settings")}</span>
        </Link>

        {onLogout ? (
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
        ) : null}
      </div>
    </aside>
  );
}

function ControlledSidebar({
  activeSection,
  items = dashboardSidebarItems,
  isCollapsed = false,
  onSectionChange,
  onToggleCollapse,
  userName,
  newDocumentTo = "/documents?upload=true",
  newDocumentLabel = "New Document",
  showNewDocument = true,
  onLogout,
}) {
  const pathname = useLocation().pathname;
  const initials = getInitials(userName);
  const activeId = activeSection || "";
  const { t } = useTranslation();
  const { openUpload } = useUploadDocModal();

  return (
    <aside
      className={
        isCollapsed
          ? "sticky top-16 flex h-[calc(100vh-64px)] min-w-0 flex-col overflow-visible border-r border-[#c7c4d7] bg-[#f2f4f6] px-[10px] py-4"
          : "sticky top-16 flex h-[calc(100vh-64px)] min-w-0 flex-col overflow-visible border-r border-[#c7c4d7] bg-[#f2f4f6] px-3 py-4"
      }
      aria-label="Dashboard navigation"
    >
      {onToggleCollapse ? (
        <button
          className="mb-3 flex h-9 w-full items-center justify-center rounded-md border border-[#c7c4d7] bg-white text-sm font-bold text-[#344154] shadow-[0_2px_8px_rgba(20,31,48,0.08)] transition hover:border-[#4648d4] hover:text-[#4648d4]"
          aria-label={isCollapsed ? "Show sidebar" : "Hide sidebar"}
          onClick={onToggleCollapse}
          type="button"
        >
          {isCollapsed ? ">" : <span className="inline-flex items-center gap-2">{"<"} <span>Hide</span></span>}
        </button>
      ) : null}

      {showNewDocument ? (
        <button
          className={
            isCollapsed
              ? "mb-5 flex min-h-9 w-full items-center justify-center rounded-md bg-[#4648d4] text-[13px] font-extrabold text-white no-underline shadow-[0_8px_18px_rgba(70,72,212,0.22)] transition hover:bg-[#383ac4]"
              : "mb-5 flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-[#4648d4] px-3 text-[13px] font-extrabold text-white no-underline shadow-[0_8px_18px_rgba(70,72,212,0.22)] transition hover:bg-[#383ac4]"
          }
          onClick={openUpload}
          type="button"
          title={newDocumentLabel}
        >
          <span>+</span>
          {!isCollapsed ? <b className="overflow-hidden text-ellipsis whitespace-nowrap">{newDocumentLabel}</b> : null}
        </button>
      ) : null}

      <nav className="grid content-start gap-2">
        {items.map((item) => {
          const isActive = item.to
            ? isPathActive(pathname, item.to)
            : activeId === item.id;

          if (item.to) {
            return (
              <Link
                className={navItemClass(isCollapsed, isActive)}
                key={item.id}
                to={item.to}
              >
                <span className="flex h-5 w-5 flex-none items-center justify-center">
                  <SidebarIcon name={item.icon} />
                </span>
                {!isCollapsed ? <b className="truncate">{t(item.labelKey || item.id)}</b> : null}
              </Link>
            );
          }

          return (
            <button
              className={navItemClass(isCollapsed, isActive)}
              key={item.id}
              onClick={() => onSectionChange?.(item.id)}
              type="button"
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center">
                <SidebarIcon name={item.icon} />
              </span>
              {!isCollapsed ? <b className="truncate">{t(item.labelKey || item.id)}</b> : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-3 border-t border-[#c7c4d7] pt-3">
        <div className={isCollapsed ? "flex justify-center" : "flex items-center gap-2 px-1"}>
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#b66a00] text-[10px] font-black text-white">
            {initials}
          </span>
          {!isCollapsed && <strong className="block min-w-0 truncate text-xs text-[#172033]">{userName || "User"}</strong>}
        </div>

        {onLogout ? (
          <button
            className={navItemClass(isCollapsed, false)}
            onClick={onLogout}
            type="button"
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center text-[#4648d4]">
              <SidebarIcon name="logout" />
            </span>
            {!isCollapsed ? <b className="truncate">Log out</b> : null}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default function DashboardSidebar(props) {
  if (typeof props.onSectionChange === "function" || typeof props.onToggleCollapse === "function" || props.items) {
    return <ControlledSidebar {...props} />;
  }

  return <DefaultSidebar {...props} />;
}
