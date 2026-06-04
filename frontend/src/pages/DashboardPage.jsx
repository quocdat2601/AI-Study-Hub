import React, { useState } from "react";
import { Link } from "react-router-dom";
import DashboardSidebar, { dashboardSidebarItems } from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const stats = [
  { icon: "D", label: "Total Documents", value: "42" },
  { icon: "B", label: "Bookmarks", value: "12" },
  { icon: "C", label: "AI Chats", value: "8" },
];

const recentDocuments = [
  { name: "Quantum Physics Intro", type: "PDF", subject: "Physics", date: "Oct 24, 2023", size: "2.4 MB" },
  { name: "Calc III Final Review", type: "DOC", subject: "Mathematics", date: "Oct 22, 2023", size: "1.1 MB" },
  { name: "Data Structures Chap 4", type: "PDF", subject: "Computer Science", date: "Oct 20, 2023", size: "4.8 MB" },
];

const learningItems = [
  { title: "Quantum Mechanics...", time: "2 hours ago" },
  { title: "Big O Notation Chat", time: "Yesterday" },
];

const subjects = ["Computer Science", "Mathematics", "Physics", "Software Engineering"];

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const displayName = getDisplayName(user);
  const sectionCopy = getSectionCopy(activeSection);
  const contentClass = isSidebarCollapsed
    ? "grid min-w-0 w-full max-w-none gap-7 px-5 py-7 lg:px-6"
    : "grid min-w-0 w-full max-w-[1220px] gap-7 p-8";

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
        <section className="flex items-center justify-between bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6">
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

        <section className="grid gap-5 grid-cols-4" aria-label="Dashboard statistics">
          <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5">
            <span className="text-[#4648d4] block text-xl mb-[10px]">U</span>
            <p className="m-0 mb-1 text-sm text-[#464554]">Storage Usage</p>
            <div className="flex items-end justify-between">
              <strong className="text-xl">1.2 GB</strong>
              <span className="text-sm text-[#464554]">/ 5 GB used</span>
            </div>
            <div className="bg-[#e6e8ea] rounded-full h-2 mt-3 overflow-hidden" aria-label="24 percent used">
              <span className="bg-[#4648d4] rounded-[inherit] block h-full w-[24%]" />
            </div>
            <p className="text-xs text-[#464554] m-0 mt-1">24% used</p>
          </article>

          {stats.map((item) => (
            <article className="flex flex-col justify-center bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] min-h-[118px] p-5" key={item.label}>
              <span className="text-[#4648d4] block text-xl mb-[10px]">{item.icon}</span>
              <p className="m-0 mb-1 text-sm text-[#464554]">{item.label}</p>
              <strong className="text-xl">{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="grid gap-7 grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
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
              {recentDocuments.map((doc) => (
                <div className="grid items-center gap-3 grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_110px_70px_60px] px-4 py-[14px] border-t border-[#d9dde6] text-[#464554] text-[13px]" key={doc.name}>
                  <div className="flex items-center gap-3 text-[#191c1e]">
                    <span className={doc.type === "DOC"
                      ? "inline-flex items-center justify-center bg-[#d5e3fc] rounded-[6px] text-[#4648d4] flex-none text-[10px] font-black h-7 w-7"
                      : "inline-flex items-center justify-center bg-[#fee2e2] rounded-[6px] text-[#ef4444] flex-none text-[10px] font-black h-7 w-7"
                    }>
                      {doc.type}
                    </span>
                    <strong>{doc.name}</strong>
                  </div>
                  <span>{doc.subject}</span>
                  <span>{doc.date}</span>
                  <span>{doc.size}</span>
                  <Link className="text-[#4648d4] text-[13px] font-extrabold no-underline" to="/library">Open</Link>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="bg-white border border-[#c7c4d7] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden p-5">
              <h2 className="text-xl leading-[1.3] m-0">Continue Learning</h2>
              <div className="grid gap-[14px] mt-4">
                {learningItems.map((item) => (
                  <Link className="grid items-center gap-3 grid-cols-[40px_1fr_auto] text-inherit no-underline" key={item.title} to="/library">
                    <span className="inline-flex items-center justify-center bg-[#d5e3fc] rounded-full text-[#4648d4] h-10 w-10">A</span>
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
                {subjects.map((subject) => (
                  <span className="bg-[#f2f4f6] border border-[#c7c4d7] rounded-[6px] text-xs font-bold px-3 py-[7px]" key={subject}>{subject}</span>
                ))}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
