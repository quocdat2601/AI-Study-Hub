import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardSidebar, { dashboardSidebarItems } from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDashboardData } from "../services/dashboardApi.js";

function getDisplayName(user) {
  if (user?.name) return user.name;
  if (user?.fullName) return user.fullName;
  if (user?.full_name) return user.full_name;
  if (user?.email) return user.email.split("@")[0].replace(/[._-]+/g, " ");
  return "Student";
}

function getSectionCopy(activeSection) {
  const current = dashboardSidebarItems.find((item) => item.id === activeSection);
  if (!current || activeSection === "dashboard") {
    return {
      title: "Welcome back",
      description: "Continue studying with your documents and AI assistant.",
    };
  }

  return {
    title: current.label,
    description: "This workspace keeps your sidebar in place while you move between study areas.",
  };
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function getDocumentType(doc) {
  const mime = doc?.cloud_files?.mime_type || "";
  if (mime.includes("word")) return "DOC";
  if (mime.includes("pdf")) return "PDF";
  return "FILE";
}

function DocumentThumbnail({ doc, type }) {
  if (doc.thumbnailUrl) {
    return (
      <img
        className="h-12 w-10 flex-none rounded border border-[#d9dde6] bg-white object-cover object-top"
        src={doc.thumbnailUrl}
        alt=""
        loading="lazy"
      />
    );
  }

  return (
    <span className={type === "DOC"
      ? "inline-flex h-12 w-10 flex-none items-end justify-center rounded border border-[#bcd0fb] bg-[#edf4ff] px-1 pb-1 text-[9px] font-black text-[#4648d4]"
      : "inline-flex h-12 w-10 flex-none items-end justify-center rounded border border-[#fecaca] bg-[#fff1f1] px-1 pb-1 text-[9px] font-black text-[#ef4444]"
    }>
      {type}
    </span>
  );
}

function DashboardDataSkeleton() {
  return (
    <div className="grid gap-7" aria-label="Loading dashboard data">
      <div className="h-[136px] rounded-xl border border-[#d9dde6] bg-white p-6">
        <div className="h-7 w-72 max-w-full rounded bg-[#e8edf5] animate-pulse" />
        <div className="mt-4 h-4 w-96 max-w-full rounded bg-[#eef2f7] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-[118px] rounded-xl border border-[#d9dde6] bg-white p-5" key={item}>
            <div className="h-5 w-8 rounded bg-[#e8edf5] animate-pulse" />
            <div className="mt-5 h-4 w-28 rounded bg-[#eef2f7] animate-pulse" />
            <div className="mt-3 h-6 w-16 rounded bg-[#e8edf5] animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
        <div className="h-72 rounded-xl border border-[#d9dde6] bg-white p-5">
          <div className="h-6 w-44 rounded bg-[#e8edf5] animate-pulse" />
          {[0, 1, 2].map((item) => (
            <div className="mt-6 h-8 rounded bg-[#eef2f7] animate-pulse" key={item} />
          ))}
        </div>
        <div className="grid gap-5">
          <div className="h-40 rounded-xl border border-[#d9dde6] bg-white p-5" />
          <div className="h-40 rounded-xl border border-[#d9dde6] bg-white p-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const displayName = getDisplayName(user);
  const sectionCopy = getSectionCopy(activeSection);
  const contentClass = isSidebarCollapsed
    ? "grid min-w-0 w-full max-w-none gap-7 px-5 py-7 lg:px-6"
    : "grid min-w-0 w-full max-w-[1220px] gap-7 p-8";

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoadingDashboard(true);
      setDashboardError("");
      try {
        const data = await getDashboardData();
        if (isMounted) setDashboardData(data);
      } catch (error) {
        if (isMounted) {
          setDashboardError(error.response?.data?.message || "Could not load dashboard data.");
        }
      } finally {
        if (isMounted) setIsLoadingDashboard(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const dashboardView = useMemo(() => {
    const storageUsed = Number(dashboardData?.storage?.used || 0);
    const storageLimit = Number(dashboardData?.storage?.limit || 0);
    const storagePercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;
    const recent = dashboardData?.recentDocuments || [];
    const learningItems = recent
      .filter((doc) => doc.extraction_status === "ready")
      .slice(0, 2)
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        time: formatDate(doc.created_at),
        label: doc.subjects?.code || "AI",
      }));

    return {
      storageUsed,
      storageLimit,
      storagePercent,
      stats: [
        { icon: "D", label: "Total Documents", value: dashboardData?.stats?.documents || 0 },
        { icon: "B", label: "Bookmarks", value: dashboardData?.stats?.bookmarks || 0 },
        { icon: "C", label: "AI Chats", value: dashboardData?.stats?.chats || 0 },
      ],
      recent,
      learningItems,
      subjects: dashboardData?.subjects || [],
    };
  }, [dashboardData]);

  return (
    <main className={isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:64px_minmax(0,1fr)]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:224px_minmax(0,1fr)]"
    }>
      <DashboardSidebar
        activeSection={activeSection}
        isCollapsed={isSidebarCollapsed}
        onSectionChange={setActiveSection}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
      />

      <section className={contentClass}>
        {isLoadingDashboard ? <DashboardDataSkeleton /> : (
          <>
            {dashboardError ? (
              <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">
                {dashboardError}
              </div>
            ) : null}

            <section className="flex items-center justify-between gap-5 bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6">
              <div>
                <h1 className="text-2xl font-bold m-0 mb-1">
                  {sectionCopy.title}
                  {activeSection === "dashboard" ? `, ${displayName}` : ""}
                </h1>
                <p className="text-[#464554] m-0">{sectionCopy.description}</p>
              </div>
              <div className="flex gap-[10px]">
                <Link className="inline-flex items-center justify-center rounded-lg text-sm font-extrabold min-h-10 px-4 bg-white border border-[#767586] text-[#191c1e] no-underline whitespace-nowrap" to="/library">
                  Upload Document
                </Link>
                <Link className="inline-flex items-center justify-center rounded-lg text-sm font-extrabold min-h-10 px-4 bg-[#4648d4] border border-[#4648d4] text-white no-underline whitespace-nowrap" to="/library">
                  Open AI Workspace
                </Link>
              </div>
            </section>

            <section className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard statistics">
              <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5">
                <span className="text-[#4648d4] block text-xl mb-[10px]">U</span>
                <p className="m-0 mb-1 text-sm text-[#464554]">Storage Usage</p>
                <div className="flex items-end justify-between">
                  <strong className="text-xl">{formatBytes(dashboardView.storageUsed)}</strong>
                  <span className="text-sm text-[#464554]">/ {formatBytes(dashboardView.storageLimit)} used</span>
                </div>
                <div className="bg-[#e6e8ea] rounded-full h-2 mt-3 overflow-hidden" aria-label={`${dashboardView.storagePercent} percent used`}>
                  <span className="bg-[#4648d4] rounded-[inherit] block h-full" style={{ width: `${dashboardView.storagePercent}%` }} />
                </div>
                <p className="text-xs text-[#464554] m-0 mt-1">{dashboardView.storagePercent}% used</p>
              </article>

              {dashboardView.stats.map((item) => (
                <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5" key={item.label}>
                  <span className="text-[#4648d4] block text-xl mb-[10px]">{item.icon}</span>
                  <p className="m-0 mb-1 text-sm text-[#464554]">{item.label}</p>
                  <strong className="text-xl">{item.value}</strong>
                </article>
              ))}
            </section>

            <section className="grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
              <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                <header className="flex items-center justify-between bg-[#f7f9fb] border-b border-[#c7c4d7] px-5 py-[18px]">
                  <h2 className="text-xl leading-[1.3] m-0">Recent Documents</h2>
                  <Link className="text-[#4648d4] text-[13px] font-extrabold no-underline" to="/library">View All</Link>
                </header>
                <div className="grid">
                  <div className="grid items-center gap-3 grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] px-4 py-[14px] bg-[#f2f4f6] text-[#464554] text-xs font-bold">
                    <span>Name</span>
                    <span>Subject</span>
                    <span>Date</span>
                    <span>Size</span>
                    <span>Action</span>
                  </div>
                  {dashboardView.recent.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#464554]">No recent documents yet.</div>
                  ) : dashboardView.recent.map((doc) => {
                    const type = getDocumentType(doc);
                    return (
                      <div className="grid items-center gap-3 grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] px-4 py-[14px] border-t border-[#d9dde6] text-[#464554] text-[13px]" key={doc.id}>
                        <div className="flex items-center gap-3 text-[#191c1e]">
                          <DocumentThumbnail doc={doc} type={type} />
                          <strong>{doc.title}</strong>
                        </div>
                        <span>{doc.subjects?.name || doc.subjects?.code || "No subject"}</span>
                        <span>{formatDate(doc.created_at)}</span>
                        <span>{formatBytes(doc.cloud_files?.size_bytes)}</span>
                        <Link className="text-[#4648d4] text-[13px] font-extrabold no-underline" to="/library">Open</Link>
                      </div>
                    );
                  })}
                </div>
              </article>

              <div className="grid gap-5">
                <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden p-5">
                  <h2 className="text-xl leading-[1.3] m-0">Continue Learning</h2>
                  <div className="grid gap-[14px] mt-4">
                    {dashboardView.learningItems.length === 0 ? (
                      <p className="m-0 text-sm text-[#464554]">Upload a readable PDF to start AI study chats.</p>
                    ) : dashboardView.learningItems.map((item) => (
                      <Link className="grid items-center gap-3 grid-cols-[40px_1fr_auto] text-inherit no-underline" key={item.id} to="/library">
                        <span className="inline-flex items-center justify-center bg-[#d5e3fc] rounded-full text-[#4648d4] h-10 w-10">{item.label.slice(0, 1)}</span>
                        <div>
                          <strong className="block text-sm">{item.title}</strong>
                          <small className="text-[#464554]">{item.time}</small>
                        </div>
                        <b className="text-[#4648d4]">-&gt;</b>
                      </Link>
                    ))}
                  </div>
                </article>

                <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden p-5">
                  <h2 className="text-xl leading-[1.3] m-0">Your Subjects</h2>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {dashboardView.subjects.length === 0 ? (
                      <span className="text-sm text-[#464554]">No subjects yet.</span>
                    ) : dashboardView.subjects.map((subject) => (
                      <span className="bg-[#f2f4f6] border border-[#c7c4d7] rounded-[6px] text-xs font-bold px-3 py-[7px]" key={subject.id}>{subject.code || subject.name}</span>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
