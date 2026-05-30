import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  createAdminSubject,
  listAdminSubjects,
  listAdminUsers,
  updateAdminUser,
} from "../services/adminApi.js";

const emptySubject = { name: "", code: "", description: "" };

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
    <main className="admin-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Platform control</h1>
        </div>
        <button className="button button--secondary" type="button" onClick={loadAdminData}>
          Refresh
        </button>
      </header>

      <div className="tabs">
        <button className={activeTab === "users" ? "tab tab--active" : "tab"} onClick={() => setActiveTab("users")}>
          Users
        </button>
        <button
          className={activeTab === "subjects" ? "tab tab--active" : "tab"}
          onClick={() => setActiveTab("subjects")}
        >
          Subjects
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}
      {isLoading ? <div className="page page--plain">Loading admin data...</div> : null}

      {!isLoading && activeTab === "users" ? (
        <section className="panel">
          <h2>User management</h2>
          {users.length === 0 ? (
            <p className="muted">No users found.</p>
          ) : (
            <div className="table-wrap">
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
                        <span className={`status status--${item.status}`}>{item.status}</span>
                      </td>
                      <td>{new Date(item.created_at || item.createdAt).toLocaleDateString()}</td>
                      <td>
                        {item.id === user.id ? (
                          <span className="muted">Current admin</span>
                        ) : item.status === "active" ? (
                          <button className="link-button" onClick={() => updateStatus(item, "disabled")}>
                            Disable
                          </button>
                        ) : (
                          <button className="link-button" onClick={() => updateStatus(item, "active")}>
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
        <section className="admin-grid">
          <form className="panel form-panel" onSubmit={saveSubject}>
            <h2>Create subject</h2>
            <label>
              Name
              <input
                value={subjectForm.name}
                onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Software Engineering"
                required
              />
            </label>
            <label>
              Code
              <input
                value={subjectForm.code}
                onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="SWP391"
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={subjectForm.description}
                onChange={(event) => setSubjectForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional course description"
                rows="4"
              />
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                Create subject
              </button>
            </div>
          </form>

          <div className="panel">
            <h2>Subjects</h2>
            {subjects.length === 0 ? (
              <p className="muted">No subjects created yet.</p>
            ) : (
              <div className="subject-list">
                {subjects.map((subject) => (
                  <article className="subject-item" key={subject.id}>
                    <div>
                      <strong>{subject.name}</strong>
                      <span>{subject.code}</span>
                      {subject.description ? <p>{subject.description}</p> : null}
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
