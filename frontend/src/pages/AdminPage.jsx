import React, { useEffect, useMemo, useState } from "react";
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
} from "../services/adminApi.js";

const emptySubject = { name: "", code: "", description: "" };

const adminSidebarItems = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard" },
  { id: "users", icon: "users", label: "Users" },
  { id: "documents", icon: "document", label: "Documents" },
  { id: "reports", icon: "reports", label: "Reports" },
  { id: "activity-logs", icon: "activity", label: "Activity Logs" },
];

const STATUS_CLASSES = {
  active: "bg-[#e8f5ee] text-[#087443]",
  disabled: "bg-[#fff0f0] text-[#b42318]",
};

const metricStyles = {
  totalUsers: { icon: "users", bg: "bg-[#ecebff]", color: "text-[#4648d4]", delta: "+12%" },
  documentsProcessed: { icon: "doc", bg: "bg-[#fff1dc]", color: "text-[#b66a00]", delta: "+5.2%" },
  aiQueries: { icon: "chip", bg: "bg-[#e5f0ff]", color: "text-[#3868a8]", delta: "Stable" },
  systemErrors: { icon: "alert", bg: "bg-[#fff0f0]", color: "text-[#dc2626]", delta: "-2%" },
};

function messageFromError(err) {
  return err.response?.data?.error || "Something went wrong. Please try again.";
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

function BarChart({ data }) {
  const values = data?.length ? data : [];
  const max = Math.max(...values.map((item) => item.value), 1);
  const points = values.map((item, index) => {
    const x = 18 + index * (252 / Math.max(values.length - 1, 1));
    const y = 116 - (item.value / max) * 80;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-5 h-[170px]">
      <div className="relative h-[132px]">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 288 132" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} fill="none" stroke="#9b9cec" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 grid h-[104px] grid-cols-7 items-end gap-2 px-1">
          {values.map((item, index) => (
            <span
              className={index === values.length - 1 ? "rounded-t-md bg-[#4648d4]" : "rounded-t-md bg-[#cbcafa]"}
              key={item.key || item.label}
              style={{ height: `${Math.max(22, (item.value / max) * 86)}px`, opacity: 0.65 + index * 0.05 }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] text-[#464554]">
        {values.map((item) => <span key={item.key || item.label}>{item.label}</span>)}
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
        {points.length ? <circle cx={points[Math.max(0, points.length - 2)].x} cy={points[Math.max(0, points.length - 2)].y} r="4" fill="#4648d4" stroke="#cbcafa" strokeWidth="4" /> : null}
      </svg>
    </div>
  );
}

function ChartCard({ title, children, action }) {
  return (
    <article className="rounded-lg border border-[#c7c4d7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between">
        <h2 className="m-0 text-base font-extrabold text-[#191c1e]">{title}</h2>
        <span className="text-[#344154]">{action}</span>
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
        <small className={style.delta.includes("-") ? "mt-1 block text-[11px] font-bold text-[#dc2626]" : "mt-1 block text-[11px] font-bold text-[#4648d4]"}>
          {style.delta}
        </small>
      </div>
    </article>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="h-10 w-64 rounded bg-[#e8edf5] animate-pulse" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-[244px] rounded-lg border border-[#d9dde6] bg-white animate-pulse" />
        <div className="h-[244px] rounded-lg border border-[#d9dde6] bg-white animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div className="h-[86px] rounded-lg border border-[#d9dde6] bg-white animate-pulse" key={item} />)}
      </div>
    </div>
  );
}

function AdminOverview({ data }) {
  const metrics = data?.metrics || {};
  const subjects = data?.subjects || [];
  const activities = data?.recentActivity || [];

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-[28px] font-extrabold leading-tight text-[#191c1e]">Dashboard Overview</h1>
        <p className="mt-1 mb-0 text-sm text-[#464554]">Key metrics and platform activity.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="User Growth" action="⌁">
          <BarChart data={data?.charts?.userGrowth || []} />
        </ChartCard>
        <ChartCard title="Document Uploads" action="⇧">
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
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#191c1e]">{subject.name}</span>
                  <span className="text-[#464554]">{subject.percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#eef0f3]">
                  <span className="block h-full rounded-full bg-[#6366e8]" style={{ width: `${subject.percentage}%` }} />
                </div>
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
                  <p className="m-0 text-xs font-bold leading-snug text-[#191c1e]">{activity.title}</p>
                  <small className="mt-1 block text-[11px] text-[#464554]">{timeAgo(activity.created_at)}</small>
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
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const displayName = getDisplayName(user);
  const contentClass = isSidebarCollapsed
    ? "grid min-w-0 w-full max-w-none gap-7 px-5 py-7 lg:px-6"
    : "grid min-w-0 w-full max-w-[1220px] gap-7 p-8";

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setIsLoading(true);
    setError("");

    try {
      const [overviewData, userData, subjectData, reportData] = await Promise.all([
        getAdminOverview(),
        listAdminUsers(),
        listAdminSubjects(),
        listAdminCommunityReports(),
      ]);
      setOverview(overviewData);
      setUsers(userData);
      setSubjects(subjectData);
      setReports(reportData);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshReports() {
    try {
      setReports(await listAdminCommunityReports());
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  async function updateStatus(targetUser, status) {
    if (!window.confirm(`Set ${targetUser.email} to ${status}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const updated = await updateAdminUser(targetUser.id, { status });
      setUsers((current) => current.map((item) => (item.id === targetUser.id ? updated : item)));
      setSuccess("User status updated");
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  function resetSubjectForm() {
    setSubjectForm(emptySubject);
  }

  async function saveSubject(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const subject = await createAdminSubject(subjectForm);
      setSubjects((current) => [...current, subject].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccess("Subject created");
      resetSubjectForm();
      await loadAdminData();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  async function resolveReport(reportId, status) {
    setError("");
    setSuccess("");

    try {
      await resolveAdminCommunityReport(reportId, status);
      setSuccess(`Report ${status}`);
      await refreshReports();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  async function moderatePost(postId, status) {
    setError("");
    setSuccess("");

    try {
      await moderateAdminCommunityPost(postId, status);
      setSuccess(`Post marked as ${status}`);
      await refreshReports();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  async function moderateReply(replyId, status) {
    setError("");
    setSuccess("");

    try {
      await moderateAdminCommunityReply(replyId, status);
      setSuccess(`Reply marked as ${status}`);
      await refreshReports();
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  function renderUsers() {
    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_18px_50px_rgba(20,31,48,0.08)]">
        <h1 className="m-0 text-2xl font-extrabold">User Management</h1>
        <p className="mt-1 mb-5 text-sm text-[#66758a]">Manage platform access and account status.</p>
        {users.length === 0 ? (
          <p className="text-[#66758a]">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#d9dde6] text-xs uppercase tracking-[0.5px] text-[#66758a]">
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Joined</th>
                  <th className="py-3 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr className="border-b border-[#eef0f3] last:border-b-0" key={item.id}>
                    <td className="py-4 pr-4 font-bold text-[#191c1e]">{item.email}</td>
                    <td className="py-4 pr-4 text-[#464554]">{item.role}</td>
                    <td className="py-4 pr-4">
                      <span className={`inline-flex rounded-full px-[10px] py-[5px] text-xs font-extrabold ${STATUS_CLASSES[item.status] ?? ""}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-[#464554]">{new Date(item.created_at || item.createdAt).toLocaleDateString()}</td>
                    <td className="py-4 pr-4">
                      {item.id === user.id ? (
                        <span className="text-[#66758a]">Current admin</span>
                      ) : item.status === "active" ? (
                        <button className="border-0 bg-transparent p-0 font-extrabold text-[#4648d4]" onClick={() => updateStatus(item, "disabled")} type="button">
                          Disable
                        </button>
                      ) : (
                        <button className="border-0 bg-transparent p-0 font-extrabold text-[#4648d4]" onClick={() => updateStatus(item, "active")} type="button">
                          Enable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderSubjects() {
    return (
      <section className="grid items-start gap-[18px] lg:grid-cols-[360px_1fr]">
        <form className="grid gap-4 rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_18px_50px_rgba(20,31,48,0.08)]" onSubmit={saveSubject}>
          <h1 className="m-0 text-2xl font-extrabold">Create Subject</h1>
          <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
            Name
            <input
              className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033]"
              value={subjectForm.name}
              onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Software Engineering"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
            Code
            <input
              className="w-full rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033]"
              value={subjectForm.code}
              onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))}
              placeholder="SWP391"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
            Description
            <textarea
              className="w-full resize-y rounded-lg border border-[#cbd5e1] px-[14px] py-3 text-[#172033]"
              value={subjectForm.description}
              onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional course description"
              rows="4"
            />
          </label>
          <button className="inline-flex min-h-11 items-center justify-center rounded-lg border-0 bg-[#4648d4] px-[18px] font-extrabold text-white" type="submit">
            Create subject
          </button>
        </form>

        <div className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_18px_50px_rgba(20,31,48,0.08)]">
          <h1 className="m-0 text-2xl font-extrabold">Subjects</h1>
          {subjects.length === 0 ? (
            <p className="text-[#66758a]">No subjects created yet.</p>
          ) : (
            <div className="mt-[18px] grid gap-3">
              {subjects.map((subject) => (
                <article className="flex items-start justify-between gap-[18px] rounded-lg border border-[#e5e9ef] p-4" key={subject.id}>
                  <div>
                    <strong>{subject.name}</strong>
                    <span className="block text-[#66758a]">{subject.code}</span>
                    {subject.description ? <p className="mt-2 mb-0 text-sm text-[#526173]">{subject.description}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderPlaceholder(title, description) {
    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-8 shadow-[0_18px_50px_rgba(20,31,48,0.08)]">
        <h1 className="m-0 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 mb-0 text-[#66758a]">{description}</p>
      </section>
    );
  }

  function renderReports() {
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

        {reports.length === 0 ? (
          <p className="mt-6 text-[#66758a]">No community reports found.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            {reports.map((report) => (
              <article className="rounded-lg border border-[#e5e9ef] p-5" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={report.status === "open" ? "rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-extrabold text-[#975a16]" : "rounded-full bg-[#eef2f7] px-3 py-1 text-xs font-extrabold text-[#42526a]"}>
                        {report.status}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#66758a]">
                        {report.reply ? "Reply Report" : "Post Report"}
                      </span>
                    </div>
                    <h2 className="mt-3 mb-0 text-lg font-extrabold text-[#191c1e]">
                      {report.post?.title || `Post #${report.reply?.postId || "Unknown"}`}
                    </h2>
                    <p className="mt-3 mb-0 text-sm leading-6 text-[#526173]">{report.reason}</p>
                    {report.reply ? (
                      <p className="mt-3 mb-0 text-sm text-[#66758a]">Reply: {report.reply.body}</p>
                    ) : null}
                    <p className="mt-3 mb-0 text-xs text-[#66758a]">
                      Reported by {report.reporter?.email || "Unknown"} - {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {report.post?.id ? (
                      <>
                        <button className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-xs font-extrabold text-[#172033]" onClick={() => moderatePost(report.post.id, "hidden")} type="button">
                          Hide Post
                        </button>
                        <button className="rounded-lg border border-[#fecaca] px-3 py-2 text-xs font-extrabold text-[#991b1b]" onClick={() => moderatePost(report.post.id, "removed")} type="button">
                          Remove Post
                        </button>
                      </>
                    ) : null}
                    {report.reply?.id ? (
                      <>
                        <button className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-xs font-extrabold text-[#172033]" onClick={() => moderateReply(report.reply.id, "hidden")} type="button">
                          Hide Reply
                        </button>
                        <button className="rounded-lg border border-[#fecaca] px-3 py-2 text-xs font-extrabold text-[#991b1b]" onClick={() => moderateReply(report.reply.id, "removed")} type="button">
                          Remove Reply
                        </button>
                      </>
                    ) : null}
                    <button className="rounded-lg bg-[#172033] px-3 py-2 text-xs font-extrabold text-white" onClick={() => resolveReport(report.id, "resolved")} type="button">
                      Resolve
                    </button>
                    <button className="rounded-lg border border-[#dbe3ed] px-3 py-2 text-xs font-extrabold text-[#172033]" onClick={() => resolveReport(report.id, "dismissed")} type="button">
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderContent() {
    if (isLoading) return <OverviewSkeleton />;
    if (activeSection === "users") return renderUsers();
    if (activeSection === "settings") return renderSubjects();
    if (activeSection === "documents") return renderPlaceholder("Documents", "Document moderation and review tools will live here.");
    if (activeSection === "reports") return renderReports();
    if (activeSection === "activity-logs") {
      return (
        <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-[0_18px_50px_rgba(20,31,48,0.08)]">
          <h1 className="m-0 text-2xl font-extrabold">Activity Logs</h1>
          <div className="mt-5 grid gap-3">
            {(overview?.recentActivity || []).map((activity) => (
              <article className="rounded-lg border border-[#eef0f3] p-4" key={activity.id}>
                <strong>{activity.title}</strong>
                <span className="mt-1 block text-sm text-[#66758a]">{timeAgo(activity.created_at)}</span>
              </article>
            ))}
          </div>
        </section>
      );
    }
    return <AdminOverview data={overview} />;
  }

  return (
    <main className={isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:64px_minmax(0,1fr)]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] transition-[grid-template-columns] duration-200 ease-out [grid-template-columns:224px_minmax(0,1fr)]"
    }>
      <DashboardSidebar
        activeSection={activeSection}
        items={adminSidebarItems}
        isCollapsed={isSidebarCollapsed}
        onSectionChange={setActiveSection}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        userName={displayName}
        showNewDocument={false}
      />

      <section className={contentClass}>
        {error ? <div className="rounded-lg bg-[#fff0f0] px-[14px] py-3 font-bold text-[#b42318]">{error}</div> : null}
        {success ? <div className="rounded-lg bg-[#e8f5ee] px-[14px] py-3 font-bold text-[#087443]">{success}</div> : null}
        {renderContent()}
      </section>
    </main>
  );
}
