import React from "react";
import { Link } from "react-router-dom";

export const dashboardSidebarItems = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "study-sets", icon: "book", label: "Study Sets" },
  { id: "documents", icon: "document", label: "Documents" },
  { id: "ai-workspace", icon: "chat", label: "AI Workspace" },
  { id: "analytics", icon: "analytics", label: "Analytics" },
];

function SidebarIcon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
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
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
        <path d="M19.4 15a8.3 8.3 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a8.8 8.8 0 0 0-1.7-1L15 6.5h-4L10.6 9a8.8 8.8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8.3 8.3 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8.8 8.8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8.8 8.8 0 0 0 1.7-1l2.4 1 2-3.5-2.2-1.5Z" />
      </>
    ),
  };

  return (
    <svg className="h-[18px] w-[18px] stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function navItemClass(isCollapsed, isActive) {
  if (isCollapsed) {
    return isActive
      ? "flex h-10 w-full items-center justify-center rounded-md border-0 bg-[#d5e3fc] text-[#344154] transition"
      : "flex h-10 w-full items-center justify-center rounded-md border-0 bg-transparent text-[#344154] transition hover:bg-white";
  }

  return isActive
    ? "flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-[#d5e3fc] px-3 text-left text-[13px] font-extrabold text-[#344154] transition"
    : "flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left text-[13px] font-bold text-[#344154] transition hover:bg-white";
}

export default function DashboardSidebar({
  activeSection,
  isCollapsed,
  onSectionChange,
  onToggleCollapse,
  userName,
}) {
  const initials = (userName || "User").slice(0, 2).toUpperCase();

  return (
    <aside
      className={
        isCollapsed
          ? "sticky top-16 flex h-[calc(100vh-64px)] min-w-0 flex-col overflow-visible border-r border-[#c7c4d7] bg-[#f2f4f6] px-[10px] py-4"
          : "sticky top-16 flex h-[calc(100vh-64px)] min-w-0 flex-col overflow-visible border-r border-[#c7c4d7] bg-[#f2f4f6] px-3 py-4"
      }
      aria-label="Dashboard navigation"
    >
      <button
        className="absolute right-[-13px] top-1/2 z-10 flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#c7c4d7] bg-white text-sm font-bold text-[#344154] shadow-[0_2px_8px_rgba(20,31,48,0.08)] transition hover:border-[#4648d4] hover:text-[#4648d4]"
        aria-label={isCollapsed ? "Show sidebar" : "Hide sidebar"}
        onClick={onToggleCollapse}
        type="button"
      >
        {isCollapsed ? ">" : "<"}
      </button>

      <Link
        className={
          isCollapsed
            ? "flex min-h-9 w-full items-center justify-center rounded-md bg-[#4648d4] text-[13px] font-extrabold text-white no-underline shadow-[0_8px_18px_rgba(70,72,212,0.22)] transition hover:bg-[#383ac4]"
            : "flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-[#4648d4] px-3 text-[13px] font-extrabold text-white no-underline shadow-[0_8px_18px_rgba(70,72,212,0.22)] transition hover:bg-[#383ac4]"
        }
        to="/library"
      >
        <span>+</span>
        <b className={isCollapsed ? "sr-only" : "overflow-hidden text-ellipsis whitespace-nowrap"}>New Document</b>
      </Link>

      <nav className="mt-5 grid content-start gap-2">
        {dashboardSidebarItems.map((item) => (
          <button
            className={navItemClass(isCollapsed, activeSection === item.id)}
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            type="button"
          >
            <span className="flex h-5 w-5 flex-none items-center justify-center">
              <SidebarIcon name={item.icon} />
            </span>
            {!isCollapsed && <b className="truncate">{item.label}</b>}
          </button>
        ))}
      </nav>

      <div className="mt-auto grid gap-3 border-t border-[#c7c4d7] pt-3">
        <div className={isCollapsed ? "flex justify-center" : "flex items-center gap-2 px-1"}>
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#b66a00] text-[10px] font-black text-white">
            {initials}
          </span>
          {!isCollapsed && <strong className="block min-w-0 truncate text-xs text-[#172033]">{userName || "User"}</strong>}
        </div>

        <button
          className={navItemClass(isCollapsed, activeSection === "settings")}
          onClick={() => onSectionChange("settings")}
          type="button"
        >
          <span className="flex h-5 w-5 flex-none items-center justify-center text-[#4648d4]">
            <SidebarIcon name="settings" />
          </span>
          {!isCollapsed && <b className="truncate">Settings</b>}
        </button>
      </div>
    </aside>
  );
}
