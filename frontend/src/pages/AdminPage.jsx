import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  createAdminSubject,
  listAdminSubjects,
  listAdminUsers,
  updateAdminUser,
} from "../services/adminApi.js";

const emptySubject = { name: "", code: "", description: "" };

const STATUS_CLASSES = {
  active: "bg-[#e8f5ee] text-[#087443] dark:bg-emerald-950 dark:text-emerald-300",
  disabled: "bg-[#fff0f0] text-[#b42318] dark:bg-red-950 dark:text-red-300",
  ready: "bg-[#e8f5ee] text-[#087443] dark:bg-emerald-950 dark:text-emerald-300",
  empty: "bg-[#fff0f0] text-[#b42318] dark:bg-red-950 dark:text-red-300",
  failed: "bg-[#fff0f0] text-[#b42318] dark:bg-red-950 dark:text-red-300",
  pending: "bg-[#fff7e6] text-[#975a16] dark:bg-amber-950 dark:text-amber-300",
};

function messageFromError(err) {
  return err.response?.data?.error || "Something went wrong. Please try again.";
}

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setIsLoading(true);
    setError("");

    try {
      const [userData, subjectData] = await Promise.all([
        listAdminUsers(),
        listAdminSubjects(),
      ]);
      setUsers(userData);
      setSubjects(subjectData);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsLoading(false);
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
    } catch (err) {
      setError(messageFromError(err));
    }
  }

  return (
    <main className="mx-auto my-8 max-w-[1120px] px-6 text-slate-900 dark:text-slate-100">
      <header className="mb-[22px] flex items-center justify-between">
        <div>
          <p className="m-0 text-[13px] font-extrabold uppercase text-teal-700 dark:text-teal-300">Admin</p>
          <h1 className="mb-2.5 mt-2">Platform control</h1>
        </div>
        <button
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-[18px] font-extrabold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          type="button"
          onClick={loadAdminData}
        >
          Refresh
        </button>
      </header>

      <div className="flex gap-2 mb-[18px]">
        <button
          className={`min-h-[42px] cursor-pointer rounded-lg border-0 px-[18px] font-extrabold ${activeTab === "users" ? "bg-teal-700 text-white dark:bg-teal-600" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          className={`min-h-[42px] cursor-pointer rounded-lg border-0 px-[18px] font-extrabold ${activeTab === "subjects" ? "bg-teal-700 text-white dark:bg-teal-600" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          onClick={() => setActiveTab("subjects")}
        >
          Subjects
        </button>
      </div>

      {error && <div className="my-4 rounded-lg bg-red-50 px-[14px] py-3 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {success && <div className="my-4 rounded-lg bg-emerald-50 px-[14px] py-3 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</div>}
      {isLoading ? <div className="py-4 text-slate-500 dark:text-slate-400">Loading admin data...</div> : null}

      {!isLoading && activeTab === "users" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl m-0 mb-2.5">User management</h2>
          {users.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.email}</td>
                      <td>{item.role}</td>
                      <td>
                        <span className={`inline-flex rounded-full text-xs font-extrabold px-[10px] py-[5px] ${STATUS_CLASSES[item.status] ?? ""}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{new Date(item.created_at || item.createdAt).toLocaleDateString()}</td>
                      <td>
                        {item.id === user.id ? (
                          <span className="text-slate-500 dark:text-slate-400">Current admin</span>
                        ) : item.status === "active" ? (
                          <button className="bg-transparent border-0 text-[#0f766e] cursor-pointer font-extrabold p-0" onClick={() => updateStatus(item, "disabled")}>
                            Disable
                          </button>
                        ) : (
                          <button className="bg-transparent border-0 text-[#0f766e] cursor-pointer font-extrabold p-0" onClick={() => updateStatus(item, "active")}>
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
      ) : null}

      {!isLoading && activeTab === "subjects" ? (
        <section className="grid items-start gap-[18px] grid-cols-[360px_1fr]">
          <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={saveSubject}>
            <h2 className="text-xl m-0 mb-2.5">Create subject</h2>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Name
              <input
                className="border border-[#cbd5e1] rounded-lg text-[#172033] px-[14px] py-3 w-full"
                value={subjectForm.name}
                onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Software Engineering"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Code
              <input
                className="border border-[#cbd5e1] rounded-lg text-[#172033] px-[14px] py-3 w-full"
                value={subjectForm.code}
                onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="SWP391"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-extrabold text-[#344154]">
              Description
              <textarea
                className="border border-[#cbd5e1] rounded-lg text-[#172033] px-[14px] py-3 w-full resize-y"
                value={subjectForm.description}
                onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional course description"
                rows="4"
              />
            </label>
            <div className="flex gap-3">
              <button className="inline-flex items-center justify-center rounded-lg cursor-pointer font-extrabold min-h-11 px-[18px] bg-[#0f766e] text-white border-0" type="submit">
                Create subject
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl m-0 mb-2.5">Subjects</h2>
            {subjects.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No subjects created yet.</p>
            ) : (
              <div className="grid gap-3 mt-[18px]">
                {subjects.map((subject) => (
                  <article className="flex items-start justify-between gap-[18px] border border-[#e5e9ef] rounded-lg p-4" key={subject.id}>
                    <div>
                      <strong>{subject.name}</strong>
                      <span className="block text-slate-500 dark:text-slate-400">{subject.code}</span>
                      {subject.description ? <p className="mt-2 mb-0 text-sm text-[#526173]">{subject.description}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
