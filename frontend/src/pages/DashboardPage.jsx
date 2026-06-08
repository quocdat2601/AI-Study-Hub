import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import {
  BookmarkIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudStorageIcon,
  DocumentFileIcon,
  DocumentTypeIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MessagesIcon,
  SectionTitle,
  SparklesIcon,
  StatIconBadge,
  UploadIcon,
} from "../components/dashboard/DashboardIcons.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDashboardData } from "../services/dashboardApi.js";
import { listSubjects } from "../services/subjectApi.js";
import { formatFileSize } from "../lib/formatFileSize.js";
import { getDisplayName } from "../lib/userDisplay.js";

const CONTINUE_ICON_STYLES = [
  "bg-pink-50 text-pink-600 ring-1 ring-pink-100 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-900",
  "bg-violet-50 text-violet-600 ring-1 ring-violet-100 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900",
  "bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDate(value);
}

function StatCard({ label, value, tone, icon, children }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <StatIconBadge tone={tone}>{icon}</StatIconBadge>
        <p className="m-0 text-sm font-semibold text-slate-600 dark:text-slate-400">{label}</p>
      </div>
      <strong className="block text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
        {value}
      </strong>
      {children}
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = getDisplayName(user);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const [dashboardData, subjectList] = await Promise.all([
          getDashboardData(),
          listSubjects(),
        ]);
        if (isMounted) {
          setDashboard(dashboardData);
          setSubjects(subjectList);
        }
      } catch {
        if (isMounted) {
          setDashboard(null);
          setSubjects([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const usedBytes = Number(dashboard?.storage?.used || 0);
  const limitBytes = Number(dashboard?.storage?.limit || 0);
  const usedPercent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const docCount = dashboard?.stats?.documents ?? 0;
  const recentDocuments = dashboard?.recentDocuments ?? [];

  return (
    <DashboardShell>
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-[28px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back, {displayName}
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">
            Continue studying with your documents and AI assistant.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 no-underline transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700"
            to="/documents?upload=true"
          >
            <UploadIcon className="h-4 w-4" />
            Upload Document
          </Link>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
            type="button"
          >
            <SparklesIcon className="h-4 w-4" />
            Open AI Workspace
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard statistics">
        <StatCard
          label="Storage Usage"
          tone="storage"
          value={isLoading ? "..." : formatFileSize(usedBytes)}
          icon={<CloudStorageIcon className="h-5 w-5" />}
        >
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{usedPercent}% used</span>
              <span>{formatFileSize(limitBytes)} limit</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span
                className="block h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
        </StatCard>

        <StatCard
          label="Total Documents"
          tone="documents"
          value={isLoading ? "..." : docCount}
          icon={<DocumentFileIcon className="h-5 w-5" />}
        />

        <StatCard
          label="Bookmarks"
          tone="bookmarks"
          value={0}
          icon={<BookmarkIcon className="h-5 w-5" />}
        />

        <StatCard
          label="AI Chats"
          tone="chats"
          value={0}
          icon={<MessagesIcon className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <SectionTitle icon={<DocumentFileIcon className="h-[18px] w-[18px]" />}>
              Recent Documents
            </SectionTitle>
            <Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 no-underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" to="/documents">
              View All
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </Link>
          </header>

          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[minmax(180px,1.8fr)_minmax(110px,1fr)_110px_80px_70px] gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <span>Name</span>
              <span>Subject</span>
              <span>Date</span>
              <span>Size</span>
              <span>Action</span>
            </div>

            {isLoading ? (
              <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">Loading documents...</p>
            ) : recentDocuments.length ? (
              recentDocuments.map((doc) => (
                <div
                  className="grid min-w-[640px] grid-cols-[minmax(180px,1.8fr)_minmax(110px,1fr)_110px_80px_70px] items-center gap-3 border-b border-slate-100 px-5 py-4 text-sm text-slate-600 transition last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/70"
                  key={doc.id}
                >
                  <div className="flex min-w-0 items-center gap-3 text-slate-900 dark:text-slate-100">
                    <DocumentTypeIcon className="h-8 w-8 shrink-0" mimeType={doc.cloud_files?.mime_type} />
                    <strong className="truncate font-medium">{doc.title}</strong>
                  </div>
                  <span className="truncate">{doc.subjects?.name || "No subject"}</span>
                  <span>{formatDate(doc.created_at)}</span>
                  <span className="tabular-nums">{formatFileSize(doc.cloud_files?.size_bytes)}</span>
                  <Link className="inline-flex items-center gap-1 font-semibold text-indigo-600 no-underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" to="/documents">
                    Open
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
                  <DocumentFileIcon className="h-7 w-7" />
                </span>
                <p className="m-0 text-sm text-slate-500 dark:text-slate-400">No documents yet.</p>
                <Link className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 no-underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" to="/documents?upload=true">
                  <UploadIcon className="h-4 w-4" />
                  Upload your first document
                </Link>
              </div>
            )}
          </div>
        </article>

        <div className="grid gap-5 content-start">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle icon={<ClockIcon className="h-[18px] w-[18px]" />}>
              Continue Learning
            </SectionTitle>
            <div className="mt-4 grid gap-2">
              {isLoading ? (
                <p className="m-0 text-sm text-slate-500 dark:text-slate-400">Loading activity...</p>
              ) : recentDocuments.length ? (
                recentDocuments.slice(0, 3).map((doc, index) => (
                  <Link
                    className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 no-underline transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                    key={`continue-${doc.id}`}
                    to="/documents"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${CONTINUE_ICON_STYLES[index % CONTINUE_ICON_STYLES.length]}`}>
                      <DocumentFileIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{doc.title}</strong>
                      <small className="text-xs text-slate-500 dark:text-slate-400">{formatRelativeTime(doc.updated_at || doc.created_at)}</small>
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      <ChevronRightIcon />
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                    <ClockIcon className="h-5 w-5" />
                  </span>
                  <p className="m-0 text-sm text-slate-500 dark:text-slate-400">Start by uploading a document to see your recent activity here.</p>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <SectionTitle icon={<GraduationCapIcon className="h-[18px] w-[18px]" />}>
              Your Subjects
            </SectionTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              {subjects.length ? subjects.map((subject) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  key={subject.id}
                >
                  <GraduationCapIcon className="h-3.5 w-3.5" />
                  {subject.name}
                </span>
              )) : (
                <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
                    <GraduationCapIcon className="h-5 w-5" />
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">No subjects yet.</span>
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </DashboardShell>
  );
}
