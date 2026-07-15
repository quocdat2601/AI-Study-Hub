import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  createAdminSubject,
  getAdminOverview,
  listAdminCommunityReports,
  listAdminSubjects,
  listAdminUsers,
  moderateAdminCommunityPost,
  moderateAdminCommunityReply,
  resolveAdminCommunityReport,
  updateAdminUser,
  updateAdminSubject,
  deleteAdminSubject,
  listAdminDocuments,
  purgeAdminDocument,
  getAiUsage,
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
} from "../services/adminApi.js";
import { getDocumentSignedUrl, deleteDocument as softDeleteDocumentApi, restoreDocument as restoreDocumentApi } from "../services/documentApi.js";
import { renderMarkdownBody } from "../components/community/communityUtils.js";
import { useToast } from "../contexts/ToastContext.jsx";

const emptySubject = { name: "", code: "", description: "" };
const ADMIN_SIDEBAR_COLLAPSED_KEY = "aiStudyHub.adminSidebarCollapsed";

const adminSidebarItems = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "ai-usage", icon: "chip", label: "AI Usage" },
  { id: "users", icon: "users", label: "Users" },
  { id: "documents", icon: "document", label: "Documents" },
  { id: "subjects", icon: "book", label: "Subjects" },
  { id: "reports", icon: "reports", label: "Reports" },
  { id: "announcements", icon: "megaphone", label: "Announcements" },
  { id: "activity-logs", icon: "activity", label: "Activity Logs" },
];

const STATUS_CLASSES = {
  active: "bg-[#e8f5ee] text-[#087443]",
  disabled: "bg-[#fff0f0] text-[#b42318]",
};

const metricStyles = {
  totalUsers: { icon: "users", bg: "bg-[#ecebff]", color: "text-[#4648d4]", subtitle: "Current total" },
  documentsProcessed: { icon: "doc", bg: "bg-[#fff1dc]", color: "text-[#b66a00]", subtitle: "Ready or indexed" },
  aiQueries: { icon: "chip", bg: "bg-[#e5f0ff]", color: "text-[#3868a8]", subtitle: "User prompts logged" },
  systemErrors: { icon: "alert", bg: "bg-[#fff0f0]", color: "text-[#dc2626]", subtitle: "Extraction failures" },
};

function messageFromError(err) {
  return err.response?.data?.error || err.message || "Something went wrong. Please try again.";
}

function getDisplayName(user) {
  if (user?.name) return user.name;
  if (user?.full_name) return user.full_name;
  if (user?.email) return user.email.split("@")[0];
  return "Admin";
}

function formatCompact(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}m`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 1 : 0)}k`;
  return String(number);
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || !bytes || isNaN(bytes)) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function timeAgo(value) {
  if (!value) return "Just now";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function parseReportReason(reasonStr) {
  const match = String(reasonStr || "").match(/^\[([^\]]+)\](.*)$/s);
  if (match) {
    return {
      category: match[1].trim(),
      details: match[2].trim() || "No additional details provided.",
    };
  }
  return {
    category: "Uncategorized",
    details: reasonStr || "No reason provided.",
  };
}

function MiniIcon({ type }) {
  const paths = {
    users: (
      <>
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M3 19c.5-3 2.2-4.5 5-4.5s4.5 1.5 5 4.5" />
        <path d="M16 11.5a2.5 2.5 0 1 0 0-5" />
        <path d="M15.5 15c2 .2 3.2 1.5 3.5 4" />
      </>
    ),
    doc: (
      <>
        <path d="M6 3.5h8l4 4v13H6v-17Z" />
        <path d="M14 3.5v4h4" />
        <path d="M9 13h6" />
      </>
    ),
    chip: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" />
      </>
    ),
    alert: (
      <>
        <path d="M12 4 21 20H3L12 4Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </>
    ),
  };

  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function AdminIcon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    subject: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    reports: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    activity: (
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  };

  return (
    <svg className="h-5 w-5 fill-none" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function AdminSidebar({
  activeSection,
  onSectionChange,
  isCollapsed,
  onToggleCollapse,
  userName,
  onLogout
}) {
  const initials = (userName || "Admin").slice(0, 2).toUpperCase();

  const sidebarItems = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "users", icon: "users", label: "Users" },
    { id: "documents", icon: "document", label: "Documents" },
    { id: "subjects", icon: "subject", label: "Subjects" },
    { id: "reports", icon: "reports", label: "Reports" },
    { id: "activity-logs", icon: "activity", label: "Activity Logs" },
  ];

  return (
    <aside
      className={`flex h-full min-w-0 flex-col border-r border-[#c7c4d7] bg-[#f2f4f6] px-3 py-4 transition-all duration-200 shrink-0 ${
        isCollapsed ? "w-16 px-[10px]" : "w-56"
      }`}
      aria-label="Admin navigation"
    >
      <button
        className="absolute right-[-13px] top-1/2 z-10 flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#c7c4d7] bg-white text-sm font-bold text-[#344154] shadow-[0_2px_8px_rgba(20,31,48,0.08)] transition hover:border-[#4648d4] hover:text-[#4648d4]"
        onClick={onToggleCollapse}
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? ">" : "<"}
      </button>

      <div className={`mb-6 flex items-center gap-3 px-1 ${isCollapsed ? "justify-center" : ""}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4648d4] text-sm font-bold text-white shadow-[0_8px_20px_rgba(70,72,212,0.28)]">
          A
        </span>
        {!isCollapsed && (
          <div className="min-w-0">
            <strong className="block truncate text-[14px] font-bold text-slate-900">StudyHub AI</strong>
            <small className="block truncate text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Admin Console</small>
          </div>
        )}
      </div>

      <nav className="grid content-start gap-1">
        {sidebarItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              className={`flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-bold text-[#344154] transition ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                isActive
                  ? "bg-[#d5e3fc] text-[#4648d4] font-extrabold"
                  : "hover:bg-white"
              }`}
              onClick={() => onSectionChange(item.id)}
              type="button"
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center">
                <AdminIcon name={item.icon} />
              </span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto grid gap-3 border-t border-[#c7c4d7] pt-3">
        <button
          className={`flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-bold text-[#344154] transition ${
            isCollapsed ? "justify-center px-0" : ""
          } ${activeSection === "help-center" ? "bg-[#d5e3fc] text-[#4648d4] font-extrabold" : "hover:bg-white"}`}
          onClick={() => onSectionChange("help-center")}
          type="button"
        >
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <AdminIcon name="help" />
          </span>
          {!isCollapsed && <span className="truncate">Help Center</span>}
        </button>

        <div className={`flex items-center gap-2 px-1 ${isCollapsed ? "justify-center" : ""}`}>
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#b66a00] text-[10px] font-black text-white">
            {initials}
          </span>
          {!isCollapsed && <strong className="block min-w-0 truncate text-xs text-[#172033]">{userName}</strong>}
        </div>

        <button
          className={`flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-[13px] font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600 ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          onClick={onLogout}
          type="button"
        >
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <AdminIcon name="logout" />
          </span>
          {!isCollapsed && <span className="truncate">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function BarChart({ data }) {
  const values = data?.length ? data : [];
  const max = Math.max(...values.map((item) => item.value), 1);
  const yTicks = [max, Math.round(max / 2), 0];

  if (!values.length || values.every((item) => Number(item.value || 0) === 0)) {
    return (
      <div className="mt-5 flex h-[170px] items-center justify-center rounded-md border border-dashed border-[#d9dde6] bg-[#f7f9fb] text-sm font-semibold text-[#66758a]">
        No user registrations in this period.
      </div>
    );
  }

  return (
    <div className="mt-5 grid h-[170px] grid-cols-[34px_1fr] gap-2">
      <div className="flex h-[132px] flex-col justify-between text-right text-[10px] font-semibold text-[#66758a]">
        {yTicks.map((tick, index) => <span key={`${tick}-${index}`}>{tick}</span>)}
      </div>
      <div>
        <div className="relative h-[132px] border-b border-l border-[#d9dde6]">
          <div className="absolute inset-0 grid grid-rows-2">
            <span className="border-b border-[#eef0f3]" />
            <span />
          </div>
          <div className="absolute inset-x-2 bottom-0 grid h-[112px] grid-cols-7 items-end gap-2">
          {values.map((item, index) => (
            <span
              className={index === values.length - 1 ? "rounded-t-md bg-[#4648d4]" : "rounded-t-md bg-[#a7a8f4]"}
              key={item.key || item.label}
              style={{ height: `${Math.max(4, (item.value / max) * 104)}px` }}
              title={`${item.label}: ${item.value}`}
            >
              <span className="sr-only">{item.label}: {item.value}</span>
            </span>
          ))}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-[10px] text-[#464554]">
          {values.map((item) => <span key={item.key || item.label}>{item.label}</span>)}
        </div>
      </div>
    </div>
  );
}

function AreaChart({ data }) {
  const values = data?.length ? data : [];
  const max = Math.max(...values.map((item) => item.value), 1);
  const points = values.map((item, index) => {
    const x = 8 + index * (272 / Math.max(values.length - 1, 1));
    const y = 114 - (item.value / max) * 78;
    return { x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `8,124 ${line} 280,124` : "";

  if (!values.length || values.every((item) => Number(item.value || 0) === 0)) {
    return (
      <div className="mt-4 flex h-[166px] items-center justify-center rounded-md border border-dashed border-[#d9dde6] bg-[#f7f9fb] text-sm font-semibold text-[#66758a]">
        No document uploads in this period.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-[#d9dde6] bg-[#f7f9fb] p-2">
      <svg className="h-[150px] w-full" viewBox="0 0 288 132" preserveAspectRatio="none" aria-label="Document uploads chart">
        <defs>
          <linearGradient id="adminUploadArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4648d4" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4648d4" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#adminUploadArea)" />
        <polyline points={line} fill="none" stroke="#4648d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={values[index]?.key || values[index]?.label || index} cx={point.x} cy={point.y} r="3" fill="#4648d4">
            <title>{values[index]?.label}: {values[index]?.value}</title>
          </circle>
        ))}
      </svg>
      <div className="grid grid-cols-7 text-center text-[10px] text-[#464554]">
        {values.map((item) => <span key={item.key || item.label}>{item.label}</span>)}
      </div>
    </div>
  );
}

function ChartCard({ title, children, action }) {
  return (
    <article className="rounded-lg border border-[#c7c4d7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between">
        <h2 className="m-0 text-base font-extrabold text-[#191c1e]">{title}</h2>
        {action ? <span className="text-[#344154]">{action}</span> : null}
      </header>
      {children}
    </article>
  );
}

function MetricCard({ label, value, metricKey }) {
  const style = metricStyles[metricKey];
  return (
    <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
      <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-md ${style.bg} ${style.color}`}>
        <MiniIcon type={style.icon} />
      </span>
      <div>
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">{label}</p>
        <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{value}</strong>
        <small className="mt-1 block text-[11px] font-bold text-[#66758a]">
          {style.subtitle}
        </small>
      </div>
    </article>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-5 animate-pulse">
      <div className="h-10 w-64 rounded bg-[#e8edf5]" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-[244px] rounded-lg border border-[#d9dde6] bg-white" />
        <div className="h-[244px] rounded-lg border border-[#d9dde6] bg-white" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div className="h-[86px] rounded-lg border border-[#d9dde6] bg-white" key={item} />)}
      </div>
    </div>
  );
}

function AdminOverview({ data }) {
  const metrics = data?.metrics || {};
  const subjects = data?.subjects || [];
  const activities = data?.recentActivity || [];
  const subjectTotal = subjects.reduce((sum, subject) => sum + Number(subject.documentCount || subject.count || 0), 0);

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">Dashboard Overview</h1>
        <p className="mt-1 mb-0 text-sm text-[#464554]">Key metrics and platform activity.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="User Growth">
          <BarChart data={data?.charts?.userGrowth || []} />
        </ChartCard>
        <ChartCard title="Document Uploads">
          <AreaChart data={data?.charts?.documentUploads || []} />
        </ChartCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Users" value={formatCompact(metrics.totalUsers)} metricKey="totalUsers" />
        <MetricCard label="Documents Processed" value={formatCompact(metrics.documentsProcessed)} metricKey="documentsProcessed" />
        <MetricCard label="AI Queries" value={formatCompact(metrics.aiQueries)} metricKey="aiQueries" />
        <MetricCard label="System Errors" value={formatCompact(metrics.systemErrors)} metricKey="systemErrors" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
        <article className="rounded-lg border border-[#c7c4d7] bg-white p-5">
          <header className="flex items-center justify-between">
            <h2 className="m-0 text-base font-extrabold">Most Active Subjects</h2>
            <button className="border-0 bg-transparent text-xs font-bold text-[#4648d4]" type="button">View All</button>
          </header>
          <div className="mt-5 grid gap-4">
            {subjects.length ? subjects.map((subject) => (
              <div key={subject.id || subject.code}>
                {(() => {
                  const count = Number(subject.documentCount || subject.count || 0);
                  const percentage = subjectTotal > 0
                    ? Number.isFinite(Number(subject.percentage))
                      ? Number(subject.percentage)
                      : Math.round((count / subjectTotal) * 100)
                    : 0;
                  return (
                    <>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#191c1e]">{subject.name}</span>
                  <span className="text-[#464554]">
                    {count} docs
                    {subjectTotal > 0 ? ` · ${percentage}%` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#eef0f3]">
                  <span className="block h-full rounded-full bg-[#6366e8]" style={{ width: `${percentage}%` }} />
                </div>
                    </>
                  );
                })()}
              </div>
            )) : <p className="m-0 text-sm text-[#464554]">No subject activity yet.</p>}
          </div>
        </article>

        <article className="overflow-hidden rounded-lg border border-[#c7c4d7] bg-white">
          <header className="border-b border-[#d9dde6] p-5">
            <h2 className="m-0 text-base font-extrabold">Recent Activity</h2>
          </header>
          <div className="grid gap-0">
            {activities.length ? activities.slice(0, 3).map((activity) => (
              <div className="grid grid-cols-[34px_1fr] gap-3 border-b border-[#eef0f3] px-5 py-4 last:border-b-0" key={activity.id}>
                <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#ecebff] text-xs font-black text-[#4648d4]">+</span>
                <div>
                  <p className="m-0 text-xs font-bold leading-snug text-[#191c1e]">{getFriendlyActivity(activity)}</p>
                  {activity.title ? (
                    <small className="mt-0.5 block truncate text-[10px] text-[#66758a]">{activity.title}</small>
                  ) : null}
                  <small className="mt-1 block text-[11px] text-[#464554]">{timeAgo(activity.created_at || activity.createdAt)}</small>
                </div>
              </div>
            )) : <p className="m-0 p-5 text-sm text-[#464554]">No recent activity.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [overview, setOverview] = useState(null);
  
  // Data lists
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "", targetRole: "all" });
  
  // Selection states (for details sidebars)
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDocs, setSelectedUserDocs] = useState([]);
  const [isFetchingUserDocs, setIsFetchingUserDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // Community reports states
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState("open");
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [editingSubject, setEditingSubject] = useState(null);
  
  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userSortOrder, setUserSortOrder] = useState("newest"); // newest, oldest, email
  
  const [docSearch, setDocSearch] = useState("");
  const [docSubjectFilter, setDocSubjectFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [docDeletedFilter, setDocDeletedFilter] = useState("active");

  const [isLoading, setIsLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    } catch {
      // Local storage can be unavailable in restricted browser modes.
    }
  }, [isSidebarCollapsed]);

  const showSuccess = useCallback((msg) => {
    addToast({ type: "success", title: "Success", message: msg });
  }, [addToast]);

  const showError = useCallback((msg) => {
    addToast({ type: "error", title: "Error", message: msg });
  }, [addToast]);

  const displayName = getDisplayName(user);
  
  const contentClass = isSidebarCollapsed
    ? "grid min-w-0 w-full max-w-none gap-7 px-5 py-7 lg:px-6"
    : "grid min-w-0 w-full max-w-[1440px] gap-7 p-8";

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [overviewData, userData, subjectData, documentData, reportData, aiUsageData, announcementData] = await Promise.all([
        getAdminOverview(),
        listAdminUsers(),
        listAdminSubjects(),
        listAdminDocuments(),
        listAdminCommunityReports(),
        getAiUsage(),
        listAnnouncements(),
      ]);
      setOverview(overviewData);
      setUsers(userData);
      setSubjects(subjectData);
      setDocuments(documentData);
      setReports(reportData);
      setAiUsage(aiUsageData);
      setAnnouncements(announcementData);
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function refreshReports() {
    try {
      setReports(await listAdminCommunityReports());
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  // User Actions
  async function updateStatus(targetUser, status) {
    if (!window.confirm(`Set ${targetUser.email} to ${status}?`)) {
      return;
    }

    try {
      const updated = await updateAdminUser(targetUser.id, { status });
      setUsers((current) => current.map((item) => (item.id === targetUser.id ? updated : item)));
      if (selectedUser && selectedUser.id === targetUser.id) {
        setSelectedUser(updated);
      }
      showSuccess(`User status updated to ${status}`);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function handleEditStorageLimit(targetUser) {
    const currentLimitGB = (targetUser.storage_limit_bytes / (1024 * 1024 * 1024)).toFixed(1);
    const input = window.prompt(`Enter new storage limit in GB for ${targetUser.email}:`, currentLimitGB);
    if (input === null) return; // user cancelled

    const gbVal = parseFloat(input);
    if (isNaN(gbVal) || gbVal <= 0) {
      alert("Please enter a valid positive number for storage limit.");
      return;
    }

    const bytes = Math.round(gbVal * 1024 * 1024 * 1024);

    try {
      const updated = await updateAdminUser(targetUser.id, { storage_limit_bytes: bytes });
      setUsers((current) => current.map((item) => (item.id === targetUser.id ? updated : item)));
      if (selectedUser && selectedUser.id === targetUser.id) {
        setSelectedUser(updated);
      }
      showSuccess("User storage limit updated");
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function handleUserClick(targetUser) {
    setSelectedUser(targetUser);
    setSelectedUserDocs([]);
    setIsFetchingUserDocs(true);
    try {
      const docs = await listAdminDocuments({ search: targetUser.email });
      // Filter exactly by user id (or user email) since search is fuzzy
      const userSpecificDocs = docs.filter(doc => doc.user_id === targetUser.id || doc.users?.email === targetUser.email);
      setSelectedUserDocs(userSpecificDocs);
    } catch (err) {
      console.error("Failed to load user documents:", err);
    } finally {
      setIsFetchingUserDocs(false);
    }
  }

  // Subject Actions
  function resetSubjectForm() {
    setSubjectForm(emptySubject);
    setEditingSubject(null);
  }

  async function saveSubject(event) {
    event.preventDefault();

    try {
      if (editingSubject) {
        // Edit Subject
        const updated = await updateAdminSubject(editingSubject.id, subjectForm);
        setSubjects((current) => current.map(item => item.id === editingSubject.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
        showSuccess("Subject updated");
      } else {
        // Create Subject
        const subject = await createAdminSubject(subjectForm);
        setSubjects((current) => [...current, subject].sort((a, b) => a.name.localeCompare(b.name)));
        showSuccess("Subject created");
      }
      resetSubjectForm();
      // Reload stats and details
      const overviewData = await getAdminOverview();
      setOverview(overviewData);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function resolveReport(reportId, status) {
    const actionKey = `${status}-report-${reportId}`;
    setProcessingAction(actionKey);

    try {
      await resolveAdminCommunityReport(reportId, status);
      showSuccess(`Report ${status}`);
      await refreshReports();
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setProcessingAction(null);
    }
  }

  async function moderatePost(postId, status) {
    const actionKey = `${status}-post-${postId}`;
    setProcessingAction(actionKey);

    try {
      await moderateAdminCommunityPost(postId, status);
      showSuccess(`Post marked as ${status}`);
      await refreshReports();
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setProcessingAction(null);
    }
  }

  async function moderateReply(replyId, status) {
    const actionKey = `${status}-reply-${replyId}`;
    setProcessingAction(actionKey);

    try {
      await moderateAdminCommunityReply(replyId, status);
      showSuccess(`Reply marked as ${status}`);
      await refreshReports();
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setProcessingAction(null);
    }
  }

  function handleEditSubjectClick(subject) {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      description: subject.description || ""
    });
  }

  async function handleDeleteSubjectClick(subject) {
    if (!window.confirm(`Are you sure you want to delete the subject "${subject.name}" (${subject.code})?`)) {
      return;
    }
    try {
      await deleteAdminSubject(subject.id);
      setSubjects((current) => current.filter(item => item.id !== subject.id));
      showSuccess("Subject deleted successfully");
      const overviewData = await getAdminOverview();
      setOverview(overviewData);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  // Document Actions
  async function handleDownloadDoc(doc) {
    try {
      const { signedUrl } = await getDocumentSignedUrl(doc.id);
      window.open(signedUrl, "_blank");
    } catch (err) {
      alert("Failed to download file: " + messageFromError(err));
    }
  }

  async function handlePurgeDoc(doc) {
    if (!window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete "${doc.title}"? This will erase the database metadata and remove the file from cloud storage. This action cannot be undone.`)) {
      return;
    }
    try {
      await purgeAdminDocument(doc.id);
      setDocuments((current) => current.filter(item => item.id !== doc.id));
      if (selectedDoc && selectedDoc.id === doc.id) {
        setSelectedDoc(null);
      }
      showSuccess("Document permanently deleted");
      const overviewData = await getAdminOverview();
      setOverview(overviewData);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function handleSoftDeleteDoc(doc) {
    const isOwner = doc.user_id === user.id;
    let reason = null;
    if (!isOwner) {
      reason = window.prompt(`Please enter the reason for moderating/deleting "${doc.title}":`);
      if (reason === null) return; // User cancelled
      if (reason.trim() === "") {
        reason = "Content violation";
      }
    } else {
      if (!window.confirm(`Are you sure you want to move "${doc.title}" to trash?`)) {
        return;
      }
    }

    try {
      await softDeleteDocumentApi(doc.id, reason);
      showSuccess("Document moved to trash successfully");
      await loadAdminData();
      setSelectedDoc(null);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function handleRestoreDoc(doc) {
    if (!window.confirm(`Are you sure you want to restore "${doc.title}" from trash?`)) {
      return;
    }
    try {
      await restoreDocumentApi(doc.id);
      showSuccess("Document restored successfully");
      await loadAdminData();
      setSelectedDoc(null);
    } catch (err) {
      showError(messageFromError(err));
    }
  }

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      showError("Title and message cannot be empty");
      return;
    }
    setProcessingAction("create-announcement");
    try {
      await createAnnouncement(announcementForm);
      showSuccess("Announcement broadcasted successfully");
      setAnnouncementForm({ title: "", message: "", targetRole: "all" });
      await loadAdminData();
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleDeleteAnnouncement(id) {
    if (!window.confirm("Are you sure you want to recall/delete this announcement? It will immediately disappear from all users' notification history.")) {
      return;
    }
    setProcessingAction(`delete-announcement-${id}`);
    try {
      await deleteAnnouncement(id);
      showSuccess("Announcement recalled successfully");
      await loadAdminData();
    } catch (err) {
      showError(messageFromError(err));
    } finally {
      setProcessingAction(null);
    }
  }

  // Computed / Filtered lists
  const filteredUsers = useMemo(() => {
    let list = [...users];

    // Status filter
    if (userStatusFilter !== "all") {
      list = list.filter((u) => u.status === userStatusFilter);
    }

    // Role filter
    if (userRoleFilter !== "all") {
      list = list.filter((u) => u.role === userRoleFilter);
    }

    // Search filter
    if (userSearch.trim()) {
      const term = userSearch.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.email?.toLowerCase().includes(term) ||
          u.name?.toLowerCase().includes(term) ||
          u.full_name?.toLowerCase().includes(term)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (userSortOrder === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (userSortOrder === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (userSortOrder === "email") {
        return (a.email || "").localeCompare(b.email || "");
      }
      return 0;
    });

    return list;
  }, [users, userStatusFilter, userRoleFilter, userSearch, userSortOrder]);

  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const disabled = users.filter((u) => u.status === "disabled").length;
    
    // New this week (7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newThisWeek = users.filter((u) => new Date(u.created_at || u.createdAt).getTime() >= sevenDaysAgo.getTime()).length;

    return { total, active, disabled, newThisWeek };
  }, [users]);

  const filteredDocs = useMemo(() => {
    let list = [...documents];

    // Subject filter
    if (docSubjectFilter !== "all") {
      list = list.filter((d) => Number(d.subject_id) === Number(docSubjectFilter));
    }

    // File Type filter
    if (docTypeFilter !== "all") {
      list = list.filter((d) => {
        const mime = d.cloud_files?.mime_type || "";
        const title = d.title || "";
        if (docTypeFilter === "pdf") {
          return mime === "application/pdf" || title.toLowerCase().endsWith(".pdf");
        }
        if (docTypeFilter === "docx") {
          return (
            mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            title.toLowerCase().endsWith(".docx")
          );
        }
        return true;
      });
    }

    // Status filter
    if (docStatusFilter !== "all") {
      list = list.filter((d) => (d.status || "").toLowerCase() === docStatusFilter);
    }

    // Search filter
    if (docSearch.trim()) {
      const term = docSearch.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.title?.toLowerCase().includes(term) ||
          d.users?.email?.toLowerCase().includes(term)
      );
    }

    // Deletion filter
    if (docDeletedFilter === "active") {
      list = list.filter((d) => d.deleted_at === null);
    } else if (docDeletedFilter === "deleted") {
      list = list.filter((d) => d.deleted_at !== null);
    }

    return list;
  }, [documents, docSubjectFilter, docTypeFilter, docStatusFilter, docDeletedFilter, docSearch]);

  const docStats = useMemo(() => {
    const total = documents.length;
    
    const pdfs = documents.filter((d) => {
      const mime = d.cloud_files?.mime_type || "";
      const title = d.title || "";
      return mime === "application/pdf" || title.toLowerCase().endsWith(".pdf");
    }).length;

    const docxs = documents.filter((d) => {
      const mime = d.cloud_files?.mime_type || "";
      const title = d.title || "";
      return (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        title.toLowerCase().endsWith(".docx")
      );
    }).length;

    const totalStorageBytes = documents.reduce((sum, d) => sum + Number(d.cloud_files?.size_bytes || 0), 0);

    return { total, pdfs, docxs, totalStorageBytes };
  }, [documents]);

  // Render sub sections
  function renderUsers() {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">User Management</h1>
          <p className="mt-1 mb-0 text-sm text-[#464554]">View, search, and manage student accounts.</p>
        </header>

        {/* User stats cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#ecebff] text-[#4648d4]">
              <MiniIcon type="users" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">Total Users</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{userStats.total}</strong>
              <small className="mt-1 block text-[11px] font-bold text-[#4648d4]">+12%</small>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#e8f5ee] text-[#087443]">
              <MiniIcon type="users" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">Active Users</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{userStats.active}</strong>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#fff0f0] text-[#dc2626]">
              <MiniIcon type="alert" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">Disabled Users</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{userStats.disabled}</strong>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#e5f0ff] text-[#3868a8]">
              <MiniIcon type="users" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">New This Week</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">+{userStats.newThisWeek}</strong>
            </div>
          </article>
        </section>

        {/* Filters and List block */}
        <div className="flex gap-6 items-start">
          <section className="flex-1 min-w-0 rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Filter Bar */}
            <div className="mb-5 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <input
                    type="text"
                    className="w-64 rounded-lg border border-[#cbd5e1] px-[14px] py-2 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Role:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none"
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Status:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none"
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <select
                  className="rounded border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-bold text-[#172033] focus:outline-none"
                  value={userSortOrder}
                  onChange={(e) => setUserSortOrder(e.target.value)}
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                  <option value="email">Sort: Email</option>
                </select>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <p className="text-[#66758a] text-center py-6">No users found matching the filter criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d9dde6] text-xs uppercase tracking-[0.5px] text-[#66758a]">
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Role</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Joined</th>
                      <th className="py-3 pr-4">Storage Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((item) => {
                      const isSelected = selectedUser?.id === item.id;
                      const userInitials = (item.email || "U").slice(0, 2).toUpperCase();
                      return (
                        <tr
                          className={`border-b border-[#eef0f3] last:border-b-0 cursor-pointer transition hover:bg-[#f8fafc] ${
                            isSelected ? "bg-[#f1f5f9]" : ""
                          }`}
                          key={item.id}
                          onClick={() => handleUserClick(item)}
                        >
                          <td className="py-3 pr-4 font-bold text-[#191c1e]">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ecebff] text-[10px] font-black text-[#4648d4] shrink-0">
                                {userInitials}
                              </span>
                              <div className="min-w-0">
                                <span className="block truncate">{getDisplayName(item)}</span>
                                <span className="block text-xs font-normal text-[#66758a] truncate">{item.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-[#464554] capitalize">{item.role}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full px-[10px] py-[3px] text-xs font-extrabold capitalize ${STATUS_CLASSES[item.status] ?? ""}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-[#464554]">{new Date(item.created_at || item.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-4 text-[#464554] font-semibold">{formatBytes(item.storage_limit_bytes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* User Details Sidebar Panel */}
          {selectedUser && (
            <aside className="w-[320px] bg-white border border-[#dfe4ea] rounded-lg p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] shrink-0 sticky top-[80px]">
              <header className="flex items-center justify-between border-b border-[#eef0f3] pb-4 mb-4">
                <h3 className="m-0 font-extrabold text-base text-[#191c1e]">User Details</h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="border-0 bg-transparent text-[#66758a] text-lg font-bold cursor-pointer"
                  type="button"
                >
                  ✕
                </button>
              </header>

              <div className="flex flex-col items-center text-center gap-2 mb-6">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4648d4] text-xl font-black text-white shadow-sm">
                  {(selectedUser.email || "U").slice(0, 2).toUpperCase()}
                </span>
                <h4 className="m-0 font-extrabold text-lg text-[#191c1e]">{getDisplayName(selectedUser)}</h4>
                <p className="m-0 text-xs text-[#66758a] break-all">{selectedUser.email}</p>
                <div className="flex gap-2 mt-1">
                  <span className="rounded bg-[#ecebff] px-2 py-0.5 text-[11px] font-bold text-[#4648d4] capitalize">{selectedUser.role}</span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${
                    selectedUser.status === "active" ? "bg-[#e8f5ee] text-[#087443]" : "bg-[#fff0f0] text-[#b42318]"
                  }`}>{selectedUser.status}</span>
                </div>
              </div>

              {/* Storage Usage Progress Bar */}
              {selectedUser.role === "student" && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-bold text-[#344154] mb-2">
                    <span>Storage Usage</span>
                    <span>
                      {formatBytes(selectedUserDocs.reduce((sum, d) => sum + Number(d.cloud_files?.size_bytes || 0), 0))} / {formatBytes(selectedUser.storage_limit_bytes)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div
                      className="bg-[#6366e8] h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedUserDocs.reduce((sum, d) => sum + Number(d.cloud_files?.size_bytes || 0), 0) /
                            selectedUser.storage_limit_bytes) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Uploaded Files Section */}
              <div className="mb-6">
                <h5 className="m-0 font-extrabold text-xs uppercase tracking-wider text-[#66758a] mb-3">
                  Uploaded Files ({selectedUserDocs.length})
                </h5>
                {isFetchingUserDocs ? (
                  <p className="text-xs text-[#66758a] italic">Loading files...</p>
                ) : selectedUserDocs.length === 0 ? (
                  <p className="text-xs text-[#66758a] italic">No files uploaded yet.</p>
                ) : (
                  <div className="max-h-[180px] overflow-y-auto grid gap-2 pr-1">
                    {selectedUserDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDoc(doc);
                          setActiveSection("documents");
                        }}
                        className="flex items-center justify-between p-2 border border-[#eef0f3] rounded hover:border-[#4648d4] cursor-pointer transition text-xs"
                      >
                        <span className="font-semibold text-slate-800 truncate pr-3">{doc.title}</span>
                        <span className="text-[#66758a] shrink-0">{formatBytes(doc.cloud_files?.size_bytes || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid gap-2 border-t border-[#eef0f3] pt-4">
                {selectedUser.id !== user.id ? (
                  <>
                    <button
                      className="w-full inline-flex h-9 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white text-xs font-bold text-[#1e293b] hover:bg-[#f8fafc] cursor-pointer"
                      onClick={() => handleEditStorageLimit(selectedUser)}
                      type="button"
                    >
                      Edit Storage Limit
                    </button>
                    {selectedUser.status === "active" ? (
                      <button
                        className="w-full inline-flex h-9 items-center justify-center rounded-lg border-0 bg-[#fff0f0] text-xs font-bold text-[#b42318] hover:bg-[#ffe1e1] cursor-pointer"
                        onClick={() => updateStatus(selectedUser, "disabled")}
                        type="button"
                      >
                        Disable Account
                      </button>
                    ) : (
                      <button
                        className="w-full inline-flex h-9 items-center justify-center rounded-lg border-0 bg-[#e8f5ee] text-xs font-bold text-[#087443] hover:bg-[#d2edd6] cursor-pointer"
                        onClick={() => updateStatus(selectedUser, "active")}
                        type="button"
                      >
                        Enable Account
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#66758a] text-center italic m-0">You are currently logged in as this user.</p>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  function renderDocuments() {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">Document Management</h1>
          <p className="mt-1 mb-0 text-sm text-[#464554]">Monitor, search, and manage uploaded study documents.</p>
        </header>

        {/* Document Stats Cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#ecebff] text-[#4648d4]">
              <MiniIcon type="doc" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">Total Documents</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{docStats.total}</strong>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#e5f0ff] text-[#3868a8]">
              <MiniIcon type="doc" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">PDF Files</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{docStats.pdfs}</strong>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#fff1dc] text-[#b66a00]">
              <MiniIcon type="doc" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">DOCX Files</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{docStats.docxs}</strong>
            </div>
          </article>

          <article className="flex min-h-[86px] items-center gap-4 rounded-lg border border-[#c7c4d7] bg-white p-4">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-[#fff0f0] text-[#dc2626]">
              <MiniIcon type="chip" />
            </span>
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.7px] text-[#464554]">Storage Used</p>
              <strong className="mt-1 block text-xl leading-none text-[#191c1e]">{formatBytes(docStats.totalStorageBytes)}</strong>
            </div>
          </article>
        </section>

        {/* Filters and List panel */}
        <div className="flex gap-6 items-start">
          <section className="flex-1 min-w-0 rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Filter bar */}
            <div className="mb-5 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  className="w-56 rounded-lg border border-[#cbd5e1] px-[14px] py-2 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                  placeholder="Search by title..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                />

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Subject:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none max-w-36"
                    value={docSubjectFilter}
                    onChange={(e) => setDocSubjectFilter(e.target.value)}
                  >
                    <option value="all">All Subjects</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Type:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none"
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                  >
                    <option value="all">File Type</option>
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Status:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none"
                    value={docStatusFilter}
                    onChange={(e) => setDocStatusFilter(e.target.value)}
                  >
                    <option value="all">Status</option>
                    <option value="indexed">Indexed</option>
                    <option value="uploaded">Uploaded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#464554]">
                  <span>Moderation:</span>
                  <select
                    className="rounded border border-[#cbd5e1] bg-white p-1 text-[#172033] focus:outline-none"
                    value={docDeletedFilter}
                    onChange={(e) => setDocDeletedFilter(e.target.value)}
                  >
                    <option value="active">Active Documents</option>
                    <option value="deleted">Trashed / Moderated</option>
                    <option value="all">All Documents</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredDocs.length === 0 ? (
              <p className="text-[#66758a] text-center py-6">No documents found matching the filter criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d9dde6] text-xs uppercase tracking-[0.5px] text-[#66758a]">
                      <th className="py-3 pr-4">Document</th>
                      <th className="py-3 pr-4">Owner</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Size</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Upload Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((item) => {
                      const isSelected = selectedDoc?.id === item.id;
                      const ownerInitials = (item.users?.email || "U").slice(0, 2).toUpperCase();
                      const isPdf = item.title?.toLowerCase().endsWith(".pdf") || item.cloud_files?.mime_type === "application/pdf";
                      
                      return (
                        <tr
                          className={`border-b border-[#eef0f3] last:border-b-0 cursor-pointer transition hover:bg-[#f8fafc] ${
                            isSelected ? "bg-[#f1f5f9]" : ""
                          }`}
                          key={item.id}
                          onClick={() => setSelectedDoc(item)}
                        >
                          <td className="py-3 pr-4 font-bold text-[#191c1e]">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded bg-[#fff8ef] text-amber-600 text-lg font-bold shrink-0">
                                {isPdf ? "📄" : "📝"}
                              </span>
                              <div className="min-w-0">
                                <span className="block truncate max-w-xs">{item.title}</span>
                                <span className="block text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2 w-max mt-0.5">
                                  {item.subjects?.code || "No Subject"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-[#464554]">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef0f3] text-[9px] font-black text-slate-700 shrink-0">
                                {ownerInitials}
                              </span>
                              <span className="truncate max-w-[150px]">{item.users?.email || "System"}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-[#464554] uppercase text-xs font-semibold">{isPdf ? "PDF" : "DOCX"}</td>
                          <td className="py-3 pr-4 text-[#464554]">{formatBytes(item.cloud_files?.size_bytes || 0)}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-extrabold capitalize ${
                              item.status === "indexed" || item.extraction_status === "ready"
                                ? "bg-[#e8f5ee] text-[#087443]"
                                : item.status === "failed" || item.extraction_status === "failed"
                                ? "bg-[#fff0f0] text-[#b42318]"
                                : "bg-[#f0f4f8] text-[#475569]"
                            }`}>
                              {item.status || item.extraction_status || "uploaded"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-[#464554]">{new Date(item.created_at || item.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Document Details Sidebar Panel */}
          {selectedDoc && (
            <aside className="w-[320px] bg-white border border-[#dfe4ea] rounded-lg p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] shrink-0 sticky top-[80px]">
              <header className="flex items-center justify-between border-b border-[#eef0f3] pb-4 mb-4">
                <h3 className="m-0 font-extrabold text-base text-[#191c1e]">Document Details</h3>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="border-0 bg-transparent text-[#66758a] text-lg font-bold cursor-pointer"
                  type="button"
                >
                  ✕
                </button>
              </header>

              {/* Document icon placeholder */}
              <div className="flex flex-col items-center justify-center p-6 bg-[#f8fafc] border border-dashed border-[#d9dde6] rounded-lg gap-3 mb-4 text-center">
                <span className="text-4xl">📄</span>
                <span className="text-xs text-[#66758a] font-bold">Preview Available inline</span>
                <span className="text-[10px] text-slate-500 break-all truncate max-w-[200px]">{selectedDoc.title}</span>
              </div>

              <div className="mb-4">
                <h4 className="m-0 font-extrabold text-sm text-slate-900 break-words">{selectedDoc.title}</h4>
                <p className="m-0 mt-1 text-[11px] text-[#66758a]">
                  Uploaded by {selectedDoc.users?.email || "System"} on {new Date(selectedDoc.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Metadata Table */}
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-b border-[#eef0f3] py-3 mb-4 text-xs">
                <span className="text-[#66758a]">File Type</span>
                <span className="font-bold text-slate-800 uppercase text-right">
                  {selectedDoc.title?.toLowerCase().endsWith(".pdf") || selectedDoc.cloud_files?.mime_type === "application/pdf" ? "PDF" : "DOCX"}
                </span>
                
                <span className="text-[#66758a]">File Size</span>
                <span className="font-bold text-slate-800 text-right">{formatBytes(selectedDoc.cloud_files?.size_bytes || 0)}</span>
                
                <span className="text-[#66758a]">Subject</span>
                <span className="font-bold text-indigo-700 text-right">{selectedDoc.subjects?.name || "No Subject"}</span>
                
                <span className="text-[#66758a]">Status</span>
                <span className="font-bold text-slate-800 capitalize text-right">{selectedDoc.status || "uploaded"}</span>
              </div>

              {/* Moderation Section */}
              {selectedDoc.moderation_reason && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <strong className="text-red-800">Moderation Reason:</strong>
                  <p className="m-0 mt-1 text-red-700 font-medium">{selectedDoc.moderation_reason}</p>
                </div>
              )}

              {/* Tags Section */}
              <div className="mb-6">
                <h5 className="m-0 font-extrabold text-xs uppercase tracking-wider text-[#66758a] mb-2">Tags</h5>
                {selectedDoc.tags ? (
                  <div className="flex flex-wrap gap-1">
                    {String(selectedDoc.tags).split(",").map((tag, idx) => (
                      <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#475569] rounded px-2 py-0.5" key={idx}>
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#66758a] italic m-0">No tags.</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid gap-2 border-t border-[#eef0f3] pt-4">
                {selectedDoc.deleted_at === null ? (
                  <>
                    <button
                      className="w-full inline-flex h-9 items-center justify-center rounded-lg border-0 bg-[#4648d4] text-xs font-bold text-white hover:bg-[#383ac4] cursor-pointer"
                      onClick={() => handleDownloadDoc(selectedDoc)}
                      type="button"
                    >
                      Download File
                    </button>
                    <button
                      className="w-full inline-flex h-9 items-center justify-center rounded-lg border border-[#b42318] bg-white text-xs font-bold text-[#b42318] hover:bg-[#fff0f0] cursor-pointer"
                      onClick={() => handleSoftDeleteDoc(selectedDoc)}
                      type="button"
                    >
                      Delete (Move to Trash)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="w-full inline-flex h-9 items-center justify-center rounded-lg border-0 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                      onClick={() => handleRestoreDoc(selectedDoc)}
                      type="button"
                    >
                      Restore Document
                    </button>
                    <button
                      className="w-full inline-flex h-9 items-center justify-center rounded-lg border border-red-600 bg-white text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                      onClick={() => handlePurgeDoc(selectedDoc)}
                      type="button"
                    >
                      Permanently Delete (Purge)
                    </button>
                    <p className="text-[10px] text-red-600 text-center italic m-0">Warning: This action cannot be undone.</p>
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  function renderSubjects() {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">Subject Configuration</h1>
          <p className="mt-1 mb-0 text-sm text-[#464554]">Configure and manage academic subjects for course categorization.</p>
        </header>

        <section className="grid items-start gap-[18px] lg:grid-cols-[360px_1fr]">
          <form className="grid gap-4 rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" onSubmit={saveSubject}>
            <h2 className="m-0 text-lg font-extrabold text-slate-800">
              {editingSubject ? `Edit Subject: ${editingSubject.code}` : "Create Subject"}
            </h2>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Name
              <input
                className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                value={subjectForm.name}
                onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Software Engineering"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Code
              <input
                className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                value={subjectForm.code}
                onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="SWP391"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Description
              <textarea
                className="w-full resize-y rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                value={subjectForm.description}
                onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional course description"
                rows="4"
              />
            </label>
            
            <div className="flex gap-2">
              <button className="flex-1 inline-flex min-h-10 items-center justify-center rounded-lg border-0 bg-[#4648d4] px-[18px] font-extrabold text-white hover:bg-[#383ac4] text-xs cursor-pointer" type="submit">
                {editingSubject ? "Save Changes" : "Create Subject"}
              </button>
              {editingSubject && (
                <button
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-[18px] font-extrabold text-slate-700 hover:bg-[#f8fafc] text-xs cursor-pointer"
                  onClick={resetSubjectForm}
                  type="button"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <h2 className="m-0 text-xl font-extrabold mb-4 text-slate-800">Subjects</h2>
            {subjects.length === 0 ? (
              <p className="text-[#66758a]">No subjects created yet.</p>
            ) : (
              <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-1">
                {subjects.map((subject) => (
                  <article className="flex items-start justify-between gap-[18px] rounded-lg border border-[#e5e9ef] p-4 transition hover:shadow-sm" key={subject.id}>
                    <div className="min-w-0">
                      <strong className="text-sm text-slate-900 block truncate">{subject.name}</strong>
                      <span className="block text-xs font-bold text-[#66758a] mt-0.5">{subject.code}</span>
                      {subject.description ? <p className="mt-2 mb-0 text-xs text-[#526173] break-words">{subject.description}</p> : null}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEditSubjectClick(subject)}
                        className="border border-[#cbd5e1] bg-white rounded px-2.5 py-1 text-xs font-bold text-[#4648d4] hover:bg-[#f8fafc] cursor-pointer"
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSubjectClick(subject)}
                        className="border border-[#cbd5e1] bg-white rounded px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-[#fff0f0] cursor-pointer"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderActivityLogs() {
    const logs = overview?.recentActivity || [];
    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <h1 className="m-0 text-2xl font-extrabold">Activity Logs</h1>
        <p className="mt-1 mb-5 text-sm text-[#66758a]">Platform audit logs and logs history.</p>
        
        {logs.length === 0 ? (
          <p className="text-sm text-[#66758a] italic">No activity logs recorded.</p>
        ) : (
          <div className="grid gap-3">
            {logs.map((activity) => (
              <article className="rounded-lg border border-[#eef0f3] p-4 flex justify-between items-start" key={activity.id}>
                <div>
                  <strong className="block text-sm text-slate-800">{activity.title}</strong>
                  <span className="mt-1 block text-xs text-[#66758a]">
                    Performed by: <span className="font-semibold text-slate-700">{activity.userEmail || "System"}</span>
                  </span>
                  {activity.description && (
                    <span className="block text-xs text-slate-500 mt-0.5">Details: {activity.description}</span>
                  )}
                </div>
                <span className="text-xs text-[#66758a] shrink-0 font-semibold">{timeAgo(activity.created_at)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderPlaceholder(title, description) {
    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <h1 className="m-0 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 mb-0 text-[#66758a]">{description}</p>
      </section>
    );
  }

  function renderReports() {
    const filteredReports = reports.filter((report) => {
      if (reportFilter === "open") return report.status === "open";
      if (reportFilter === "resolved") return report.status === "resolved" || report.status === "dismissed";
      return true;
    });

    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_18px_50px_rgba(20,31,48,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-2xl font-extrabold">Community Reports</h1>
            <p className="mt-1 mb-0 text-sm text-[#66758a]">Review reported posts and replies, then moderate or resolve them.</p>
          </div>
          <button className="inline-flex items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-extrabold text-[#172033]" onClick={refreshReports} type="button">
            Refresh
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between border-b border-[#e2e8f0] pb-2">
          <div className="flex gap-4">
            {[
              { id: "open", label: "Open Reports" },
              { id: "resolved", label: "Resolved / Dismissed" },
              { id: "all", label: "All Reports" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportFilter(tab.id)}
                className={`border-b-2 px-1 pb-2 text-sm font-bold transition-all ${
                  reportFilter === tab.id
                    ? "border-[#4648d4] text-[#4648d4]"
                    : "border-transparent text-[#66758a] hover:text-[#172033]"
                }`}
                type="button"
              >
                {tab.label} ({
                  reports.filter((r) => {
                    if (tab.id === "open") return r.status === "open";
                    if (tab.id === "resolved") return r.status === "resolved" || r.status === "dismissed";
                    return true;
                  }).length
                })
              </button>
            ))}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <p className="mt-6 text-[#66758a]">No community reports found.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {filteredReports.map((report) => {
              const parsed = parseReportReason(report.reason);
              return (
                <article className="rounded-lg border border-[#e5e9ef] p-5 bg-white" key={report.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={report.status === "open" ? "rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-extrabold text-[#975a16]" : "rounded-full bg-[#eef2f7] px-3 py-1 text-xs font-extrabold text-[#42526a]"}>
                          Report: {report.status}
                        </span>
                        <span className="rounded-full bg-[#eeefff] px-3 py-1 text-xs font-extrabold text-[#4648d4]">
                          {parsed.category}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#66758a]">
                          {report.reply ? "Reply Report" : "Post Report"}
                        </span>
                        {report.post && report.post.status !== "active" ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${report.post.status === "hidden" ? "bg-[#f1f5f9] text-[#475569]" : "bg-[#fef2f2] text-[#991b1b]"}`}>
                            Content: {report.post.status}
                          </span>
                        ) : null}
                        {report.reply && report.reply.status !== "active" ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${report.reply.status === "hidden" ? "bg-[#f1f5f9] text-[#475569]" : "bg-[#fef2f2] text-[#991b1b]"}`}>
                            Content: {report.reply.status}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 mb-0 text-lg font-extrabold text-[#191c1e]">
                        {report.post ? (
                          <a
                            href={`/community/posts/${report.post.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#4648d4] hover:underline"
                          >
                            {report.post.title}
                          </a>
                        ) : report.reply ? (
                          <>
                            Comment on:{" "}
                            <a
                              href={`/community/posts/${report.reply.postId}#community-reply-${report.reply.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#4648d4] hover:underline"
                            >
                              {report.reply.postTitle || `Post #${report.reply.postId}`}
                            </a>
                          </>
                        ) : (
                          "Unknown Content"
                        )}
                      </h2>
                      <div className="mt-2 text-sm font-semibold text-[#66758a]">
                        Report Detail: <span className="font-normal text-[#191c1e]">{parsed.details}</span>
                      </div>
                      {report.post?.body ? (
                        <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#334155] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                          <strong className="text-xs uppercase tracking-wider text-[#66758a] block mb-1">Post Content</strong>
                          {renderMarkdownBody(report.post.body, React)}
                        </div>
                      ) : null}
                      {report.reply ? (
                        <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#334155] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                          <strong className="text-xs uppercase tracking-wider text-[#66758a] block mb-1">Comment Content</strong>
                          {renderMarkdownBody(report.reply.body, React)}
                        </div>
                      ) : null}
                      <p className="mt-3 mb-0 text-xs text-[#66758a]">
                        Reported by <span className="font-semibold text-[#464554]">{report.reporter?.email || "Unknown"}</span> - {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {report.status === "open" ? (
                        <>
                          {report.post?.id && report.post.status === "active" ? (
                            <>
                              <button
                                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-extrabold text-[#172033] shadow-sm transition-all duration-200 hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                onClick={() => moderatePost(report.post.id, "hidden")}
                                disabled={processingAction !== null}
                                type="button"
                              >
                                {processingAction === `hidden-post-${report.post.id}` ? "Hiding..." : "Hide Post"}
                              </button>
                              <button
                                className="rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-xs font-extrabold text-[#991b1b] shadow-sm transition-all duration-200 hover:bg-[#fff5f5] hover:border-[#fca5a5] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                onClick={() => moderatePost(report.post.id, "removed")}
                                disabled={processingAction !== null}
                                type="button"
                              >
                                {processingAction === `removed-post-${report.post.id}` ? "Removing..." : "Remove Post"}
                              </button>
                            </>
                          ) : null}
                          {report.reply?.id && report.reply.status === "active" ? (
                            <>
                              <button
                                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-extrabold text-[#172033] shadow-sm transition-all duration-200 hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                onClick={() => moderateReply(report.reply.id, "hidden")}
                                disabled={processingAction !== null}
                                type="button"
                              >
                                {processingAction === `hidden-reply-${report.reply.id}` ? "Hiding..." : "Hide Reply"}
                              </button>
                              <button
                                className="rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-xs font-extrabold text-[#991b1b] shadow-sm transition-all duration-200 hover:bg-[#fff5f5] hover:border-[#fca5a5] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                onClick={() => moderateReply(report.reply.id, "removed")}
                                disabled={processingAction !== null}
                                type="button"
                              >
                                {processingAction === `removed-reply-${report.reply.id}` ? "Removing..." : "Remove Reply"}
                              </button>
                            </>
                          ) : null}
                          <button
                            className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-extrabold text-[#344054] shadow-sm transition-all duration-200 hover:bg-[#f8fafc] hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                            onClick={() => resolveReport(report.id, "dismissed")}
                            disabled={processingAction !== null}
                            type="button"
                          >
                            {processingAction === `dismissed-report-${report.id}` ? "Dismissing..." : "Dismiss Report"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-[#66758a] italic">
                          Resolved at {new Date(report.resolvedAt).toLocaleString()} by {report.resolver?.email || "system"}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  function renderAiUsage() {
    if (!aiUsage) {
      return (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[#dfe4ea] bg-white text-sm font-semibold text-[#66758a]">
          Loading AI Usage stats...
        </div>
      );
    }

    const { byModel = [], topUsers = [], requestsPerDay = [], liveQuota = [] } = aiUsage;

    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">AI Usage & Cost Monitoring</h1>
          <p className="mt-1 mb-0 text-sm text-[#464554]">Real-time query metrics, token consumption, and model quota limits.</p>
        </header>

        {/* Live Quotas Section */}
        <section className="grid gap-5 md:grid-cols-2">
          {liveQuota.map((quota) => {
            const hasLimits = quota.limits && quota.limits.rpm;
            const rpmPct = hasLimits ? Math.min(100, Math.round((quota.used.requestsThisMinute / quota.limits.rpm) * 100)) : 0;
            const tpmPct = hasLimits ? Math.min(100, Math.round((quota.used.tokensThisMinute / quota.limits.tpm) * 100)) : 0;
            const rpdPct = hasLimits ? Math.min(100, Math.round((quota.used.requestsToday / quota.limits.rpd) * 100)) : 0;

            const getBarColor = (pct) => {
              if (pct > 85) return "bg-red-600";
              if (pct > 60) return "bg-amber-500";
              return "bg-emerald-600";
            };

            return (
              <article className="rounded-lg border border-[#c7c4d7] bg-white p-5 shadow-sm" key={quota.model}>
                <header className="flex items-center justify-between border-b border-[#eef0f3] pb-3 mb-4">
                  <h3 className="m-0 text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-xs">🤖</span>
                    {quota.model}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                    {quota.provider}
                  </span>
                </header>

                <div className="grid gap-4">
                  {/* Requests per minute */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Requests per Minute (RPM)</span>
                      <span className="text-slate-800">
                        {quota.used.requestsThisMinute} / {hasLimits ? quota.limits.rpm : "∞"}
                        {hasLimits ? ` (${rpmPct}%)` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(rpmPct)}`}
                        style={{ width: `${hasLimits ? rpmPct : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Tokens per minute */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Tokens per Minute (TPM)</span>
                      <span className="text-slate-800">
                        {formatCompact(quota.used.tokensThisMinute)} / {hasLimits ? formatCompact(quota.limits.tpm) : "∞"}
                        {hasLimits ? ` (${tpmPct}%)` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(tpmPct)}`}
                        style={{ width: `${hasLimits ? tpmPct : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Requests per day */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Requests per Day (RPD)</span>
                      <span className="text-slate-800">
                        {quota.used.requestsToday} / {hasLimits ? quota.limits.rpd : "∞"}
                        {hasLimits ? ` (${rpdPct}%)` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getBarColor(rpdPct)}`}
                        style={{ width: `${hasLimits ? rpdPct : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {/* Charts & Models Overview */}
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <ChartCard title="AI Requests per Day (Last 7 Days)">
            <BarChart data={requestsPerDay} />
          </ChartCard>

          <article className="rounded-lg border border-[#c7c4d7] bg-white p-5 flex flex-col justify-between shadow-sm">
            <header className="border-b border-[#eef0f3] pb-3 mb-4">
              <h2 className="m-0 text-sm font-extrabold text-slate-900">Usage by Model</h2>
            </header>
            <div className="grid gap-3 overflow-y-auto max-h-[220px]">
              {byModel.length ? byModel.map((modelItem) => (
                <div className="flex items-center justify-between border-b border-[#f8fafc] pb-2 last:border-b-0" key={modelItem.model}>
                  <div>
                    <span className="block text-xs font-bold text-slate-800 truncate max-w-[185px]">{modelItem.model}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{modelItem.provider}</span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="block font-semibold text-slate-700">{modelItem.total_requests} reqs</span>
                    <span className="text-[10px] text-slate-500">{formatCompact(modelItem.total_tokens)} tokens</span>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-[#66758a] italic m-0">No API traffic recorded in this period.</p>
              )}
            </div>
          </article>
        </section>

        {/* Top Consumers Table */}
        <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="m-0 text-base font-extrabold text-slate-900">Top User Consumers Today</h2>
            <p className="m-0 mt-0.5 text-xs text-[#66758a]">Students generating the highest volume of prompt requests and tokens today.</p>
          </header>

          {topUsers.length === 0 ? (
            <div className="flex h-[100px] items-center justify-center text-xs font-semibold text-[#66758a] italic">
              No user requests recorded today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#d9dde6] text-[10px] uppercase tracking-wider text-[#66758a] font-bold">
                    <th className="py-2.5 pr-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 pr-4">User Email</th>
                    <th className="py-2.5 pr-4 text-right">Total Requests</th>
                    <th className="py-2.5 pr-4 text-right">Total Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((item, idx) => {
                    const initials = (item.email || "U").slice(0, 2).toUpperCase();
                    return (
                      <tr className="border-b border-[#eef0f3] last:border-b-0" key={item.user_id}>
                        <td className="py-3 pr-4 text-center font-bold text-slate-600">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                            idx === 0 ? "bg-amber-100 text-amber-800" : idx === 1 ? "bg-slate-100 text-slate-800" : "bg-orange-50 text-orange-700"
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-[#191c1e]">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#eef0f3] text-[8px] font-bold text-slate-600">
                              {initials}
                            </span>
                            <span className="truncate max-w-[200px]">{item.email}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right font-bold text-slate-800">{item.request_count}</td>
                        <td className="py-3 pr-4 text-right text-slate-600">{formatCompact(item.total_tokens)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderAnnouncements() {
    const totalActiveUsers = users.filter(u => u.status === 'active').length;

    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">Admin Announcements</h1>
          <p className="mt-1 mb-0 text-sm text-[#464554]">Broadcast notifications and system-wide announcements to students or administrative users.</p>
        </header>

        <section className="grid items-start gap-[18px] lg:grid-cols-[360px_1fr]">
          {/* Broadcast Form */}
          <form className="grid gap-4 rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" onSubmit={handleCreateAnnouncement}>
            <h2 className="m-0 text-lg font-extrabold text-slate-800">Broadcast Announcement</h2>
            
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Title
              <input
                className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(current => ({ ...current, title: e.target.value }))}
                placeholder="e.g., Scheduled System Maintenance"
                maxLength={150}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Message
              <textarea
                className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none min-h-[100px] resize-y"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm(current => ({ ...current, message: e.target.value }))}
                placeholder="Write your announcement details here..."
                maxLength={500}
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Target Audience
              <select
                className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033] text-sm focus:border-[#4648d4] focus:outline-none bg-white"
                value={announcementForm.targetRole}
                onChange={(e) => setAnnouncementForm(current => ({ ...current, targetRole: e.target.value }))}
              >
                <option value="all">All Users</option>
                <option value="user">Students Only</option>
                <option value="admin">Administrators Only</option>
              </select>
            </label>

            <button
              className="w-full inline-flex h-11 items-center justify-center rounded-lg border-0 bg-[#4648d4] text-xs font-bold text-white hover:bg-[#383ac4] cursor-pointer disabled:opacity-50"
              disabled={processingAction === "create-announcement"}
              type="submit"
            >
              {processingAction === "create-announcement" ? "Broadcasting..." : "Broadcast Megaphone 📢"}
            </button>
          </form>

          {/* History list */}
          <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <h2 className="m-0 text-lg font-extrabold text-slate-800 mb-4">Broadcast History</h2>
            {announcements.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm font-semibold text-[#66758a] italic">
                No announcements broadcasted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#d9dde6] text-[10px] uppercase tracking-wider text-[#66758a] font-bold">
                      <th className="py-3 pr-4">Title</th>
                      <th className="py-3 pr-4">Target</th>
                      <th className="py-3 pr-4">Created At</th>
                      <th className="py-3 pr-4 text-center">Read Ratio</th>
                      <th className="py-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((item) => {
                      const ratio = totalActiveUsers > 0 ? Math.round((item.read_count / totalActiveUsers) * 100) : 0;
                      return (
                        <tr className="border-b border-[#eef0f3] last:border-b-0" key={item.id}>
                          <td className="py-3 pr-4 max-w-xs">
                            <span className="block font-bold text-slate-800 break-words">{item.title}</span>
                            <span className="block text-[10px] text-slate-500 mt-1 line-clamp-2 break-words">{item.message}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold capitalize ${
                              item.target_role === "all"
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : item.target_role === "admin"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}>
                              {item.target_role === "all" ? "All" : item.target_role === "admin" ? "Admins" : "Students"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-600 font-medium">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-slate-800">{item.read_count} read</span>
                              <span className="text-[10px] text-slate-500 mt-0.5">{ratio}% of active users</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <button
                              className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                              onClick={() => handleDeleteAnnouncement(item.id)}
                              disabled={processingAction === `delete-announcement-${item.id}`}
                              type="button"
                            >
                              {processingAction === `delete-announcement-${item.id}` ? "Recalling..." : "Recall"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    );
  }

  function renderContent() {
    if (isLoading) return <OverviewSkeleton />;
    if (activeSection === "users") return renderUsers();
    if (activeSection === "ai-usage") return renderAiUsage();
    if (activeSection === "announcements") return renderAnnouncements();
    if (activeSection === "documents") return renderDocuments();
    if (activeSection === "subjects") return renderSubjects();
    if (activeSection === "activity-logs") return renderActivityLogs();
    if (activeSection === "reports") return renderReports();
    if (activeSection === "settings") return renderPlaceholder("Settings", "Administrative settings and configuration panel.");
    if (activeSection === "help-center") return renderPlaceholder("Help Center", "Admin help resources and developer documentation.");
    return <AdminOverview data={overview} />;
  }

  return (
    <main className={`grid min-h-[calc(100vh-65px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out ${
      isSidebarCollapsed ? "[grid-template-columns:64px_minmax(0,1fr)]" : "[grid-template-columns:224px_minmax(0,1fr)]"
    }`}>
      <DashboardSidebar
        activeSection={activeSection}
        isCollapsed={isSidebarCollapsed}
        items={adminSidebarItems}
        newDocumentLabel="New Document"
        onLogout={logout}
        onSectionChange={setActiveSection}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        showNewDocument={false}
        userName={displayName}
      />

      <section className="min-w-0 overflow-x-hidden">
        <div className={contentClass}>
        {renderContent()}
        </div>
      </section>
    </main>
  );
}

function getFriendlyActivity(activity) {
  const raw = activity?.title || activity?.action || activity?.event_type || activity?.type || "Platform activity";
  const normalized = String(raw).replace(/[._-]+/g, " ").trim();
  const lower = normalized.toLowerCase();

  if (lower.includes("purge")) return "Document cleanup completed";
  if (lower.includes("upload")) return "Document uploaded";
  if (lower.includes("chat")) return "Chat activity recorded";
  if (lower.includes("user") && lower.includes("register")) return "New user registered";
  if (lower.includes("subject")) return "Subject configuration changed";
  if (lower.includes("error") || lower.includes("failed")) return "Processing issue detected";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
