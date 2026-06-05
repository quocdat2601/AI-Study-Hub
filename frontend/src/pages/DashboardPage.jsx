import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardSidebar, { dashboardSidebarItems } from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getDashboardData } from "../services/dashboardApi.js";
import { listSubjects } from "../services/subjectApi.js";
import { formatFileSize } from "../lib/formatFileSize.js";

function getDisplayName(user) {
  if (user?.name) return user.name;
  if (user?.fullName) return user.fullName;
  if (user?.full_name) return user.full_name;
  if (user?.email) return user.email.split("@")[0].replace(/[._-]+/g, " ");
  return "Student";
}

function getMimeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  return "FILE";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = getDisplayName(user);
  const sectionCopy = getSectionCopy(activeSection);
  const contentClass = isSidebarCollapsed
    ? "grid min-w-0 w-full max-w-none gap-7 px-5 py-7 lg:px-6"
    : "grid min-w-0 w-full max-w-[1220px] gap-7 p-8";

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

  function handleSectionChange(sectionId) {
    if (sectionId === "documents") {
      navigate("/documents");
      return;
    }
    setActiveSection(sectionId);
  }

  const usedBytes = Number(dashboard?.storage?.used || 0);
  const limitBytes = Number(dashboard?.storage?.limit || 0);
  const usedPercent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const docCount = dashboard?.stats?.documents ?? 0;
  const recentDocuments = dashboard?.recentDocuments ?? [];

  return (
    <main className={isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:64px_minmax(0,1fr)]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:224px_minmax(0,1fr)]"
    }>
      <DashboardSidebar
        activeSection={activeSection}
        isCollapsed={isSidebarCollapsed}
        onSectionChange={handleSectionChange}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
      />

      <section className={contentClass}>
        <section className="flex items-center justify-between bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6">
          <div>
            <h1 className="text-2xl font-bold m-0 mb-1">
              {sectionCopy.title}
              {activeSection === "dashboard" ? `, ${displayName}` : ""}
            </h1>
            <p className="text-[#464554] m-0">{sectionCopy.description}</p>
          </div>
          <div className="flex gap-[10px]">
            <Link className="inline-flex items-center justify-center rounded-lg text-sm font-extrabold min-h-10 px-4 bg-white border border-[#767586] text-[#191c1e] no-underline whitespace-nowrap" to="/documents?upload=true">
              Upload Documents
            </Link>
            <Link className="inline-flex items-center justify-center rounded-lg text-sm font-extrabold min-h-10 px-4 bg-[#4648d4] border border-[#4648d4] text-white no-underline whitespace-nowrap" to="/documents">
              View Documents
            </Link>
          </div>
        </section>

        <section className="grid gap-5 grid-cols-4" aria-label="Dashboard statistics">
          <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5">
            <span className="text-[#4648d4] block text-xl mb-[10px]">U</span>
            <p className="m-0 mb-1 text-sm text-[#464554]">Storage Usage</p>
            <div className="flex items-end justify-between">
              <strong className="text-xl">{formatFileSize(usedBytes)}</strong>
              <span className="text-sm text-[#464554]">/ {formatFileSize(limitBytes)}</span>
            </div>
            <div className="bg-[#e6e8ea] rounded-full h-2 mt-3 overflow-hidden" aria-label={`${usedPercent} percent used`}>
              <span className="bg-[#4648d4] rounded-[inherit] block h-full" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="text-xs text-[#464554] m-0 mt-1">{usedPercent}% used</p>
          </article>

          <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5">
            <span className="text-[#4648d4] block text-xl mb-[10px]">D</span>
            <p className="m-0 mb-1 text-sm text-[#464554]">Total Documents</p>
            <strong className="text-xl">{isLoading ? "..." : docCount}</strong>
          </article>
        </section>

        <section className="grid gap-7 grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
          <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
            <header className="flex items-center justify-between bg-[#f7f9fb] border-b border-[#c7c4d7] px-5 py-[18px]">
              <h2 className="text-xl leading-[1.3] m-0">Recent Documents</h2>
              <Link className="text-[#4648d4] text-[13px] font-extrabold no-underline" to="/documents">View All</Link>
            </header>
            <div className="grid">
              <div className="grid items-center gap-3 grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] px-4 py-[14px] bg-[#f2f4f6] text-[#464554] text-xs font-bold">
                <span>Name</span>
                <span>Subject</span>
                <span>Date</span>
                <span>Size</span>
                <span>Action</span>
              </div>
              {isLoading ? (
                <p className="px-4 py-6 text-sm text-[#464554]">Loading documents...</p>
              ) : recentDocuments.length ? (
                recentDocuments.map((doc) => {
                  const mimeLabel = getMimeLabel(doc.cloud_files?.mime_type);
                  return (
                    <div className="grid items-center gap-3 grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] px-4 py-[14px] border-t border-[#d9dde6] text-[#464554] text-[13px]" key={doc.id}>
                      <div className="flex items-center gap-3 text-[#191c1e]">
                        <span className={mimeLabel === "DOCX"
                          ? "inline-flex items-center justify-center bg-[#d5e3fc] rounded-[6px] text-[#4648d4] flex-none text-[10px] font-black h-7 w-7"
                          : "inline-flex items-center justify-center bg-[#fee2e2] rounded-[6px] text-[#ef4444] flex-none text-[10px] font-black h-7 w-7"
                        }>
                          {mimeLabel}
                        </span>
                        <strong>{doc.title}</strong>
                      </div>
                      <span>{doc.subjects?.name || "No subject"}</span>
                      <span>{formatDate(doc.created_at)}</span>
                      <span>{formatFileSize(doc.cloud_files?.size_bytes)}</span>
                      <Link className="text-[#4648d4] text-[13px] font-extrabold no-underline" to="/documents">Open</Link>
                    </div>
                  );
                })
              ) : (
                <p className="px-4 py-6 text-sm text-[#464554]">No documents yet. Upload your first document.</p>
              )}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden p-5">
              <h2 className="text-xl leading-[1.3] m-0">Quick Actions</h2>
              <div className="grid gap-[14px] mt-4">
                <Link className="grid items-center gap-3 grid-cols-[40px_1fr_auto] text-inherit no-underline" to="/documents?upload=true">
                  <span className="inline-flex items-center justify-center bg-[#d5e3fc] rounded-full text-[#4648d4] h-10 w-10">+</span>
                  <div>
                    <strong className="block text-sm">Upload new document</strong>
                    <small className="text-[#464554]">PDF or DOCX</small>
                  </div>
                  <b className="text-[#4648d4]">-&gt;</b>
                </Link>
                <Link className="grid items-center gap-3 grid-cols-[40px_1fr_auto] text-inherit no-underline" to="/documents">
                  <span className="inline-flex items-center justify-center bg-[#d5e3fc] rounded-full text-[#4648d4] h-10 w-10">D</span>
                  <div>
                    <strong className="block text-sm">Manage documents</strong>
                    <small className="text-[#464554]">Search, edit, delete</small>
                  </div>
                  <b className="text-[#4648d4]">-&gt;</b>
                </Link>
              </div>
            </article>

            <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden p-5">
              <h2 className="text-xl leading-[1.3] m-0">Your Subjects</h2>
              <div className="flex flex-wrap gap-2 mt-4">
                {subjects.length ? subjects.map((subject) => (
                  <span className="bg-[#f2f4f6] border border-[#c7c4d7] rounded-[6px] text-xs font-bold px-3 py-[7px]" key={subject.id}>{subject.name}</span>
                )) : (
                  <span className="text-sm text-[#464554]">No subjects yet.</span>
                )}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
