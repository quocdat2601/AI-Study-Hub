import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

const stats = [
  { icon: "▣", label: "Total Documents", value: "42" },
  { icon: "◇", label: "Bookmarks", value: "12" },
  { icon: "◱", label: "AI Chats", value: "8" },
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

function getDisplayName(email) {
  if (!email) return "Student";
  return email.split("@")[0].replace(/[._-]+/g, " ");
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const displayName = getDisplayName(user?.email);

  return (
    <main className="student-dashboard">
      <aside className="student-sidebar" aria-label="Dashboard navigation">
        <Link className="student-sidebar__new" to="/library">
          <span>+</span>
          New Document
        </Link>

        <nav className="student-sidebar__nav">
          <Link className="student-sidebar__link student-sidebar__link--active" to="/dashboard">
            <span>▦</span>
            Dashboard
          </Link>
          <Link className="student-sidebar__link" to="/library">
            <span>▤</span>
            Study Sets
          </Link>
          <Link className="student-sidebar__link" to="/library">
            <span>▧</span>
            Documents
          </Link>
          <Link className="student-sidebar__link" to="/library">
            <span>◌</span>
            AI Workspace
          </Link>
          <a className="student-sidebar__link" href="#analytics">
            <span>▥</span>
            Analytics
          </a>
        </nav>

        <div className="student-sidebar__footer">
          <a className="student-sidebar__link" href="#settings">
            <span>⚙</span>
            Settings
          </a>
          <button className="student-sidebar__link" onClick={logout} type="button">
            <span>↪</span>
            Log Out
          </button>
        </div>
      </aside>

      <section className="student-dashboard__content">
        <section className="student-welcome">
          <div>
            <h1>Welcome back, {displayName}</h1>
            <p>Continue studying with your documents and AI assistant.</p>
          </div>
          <div className="student-welcome__actions">
            <Link className="student-button student-button--outline" to="/library">
              Upload Document
            </Link>
            <Link className="student-button student-button--primary" to="/library">
              Open AI Workspace
            </Link>
          </div>
        </section>

        <section className="student-stat-grid" aria-label="Dashboard statistics">
          <article className="student-stat-card student-stat-card--storage">
            <h2>
              <span>☁</span>
              Storage Usage
            </h2>
            <div className="student-stat-card__usage">
              <strong>1.2 GB</strong>
              <span>/ 5 GB used</span>
            </div>
            <div className="student-progress" aria-label="24 percent used">
              <span />
            </div>
            <p>24% used</p>
          </article>

          {stats.map((item) => (
            <article className="student-stat-card" key={item.label}>
              <span className="student-stat-card__icon">{item.icon}</span>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="student-dashboard__grid">
          <article className="student-panel student-panel--documents">
            <header>
              <h2>Recent Documents</h2>
              <Link to="/library">View All</Link>
            </header>
            <div className="student-table">
              <div className="student-table__head">
                <span>Name</span>
                <span>Subject</span>
                <span>Date</span>
                <span>Size</span>
                <span>Action</span>
              </div>
              {recentDocuments.map((doc) => (
                <div className="student-table__row" key={doc.name}>
                  <div className="student-doc-name">
                    <span className={doc.type === "DOC" ? "student-doc-icon student-doc-icon--doc" : "student-doc-icon"}>
                      {doc.type}
                    </span>
                    <strong>{doc.name}</strong>
                  </div>
                  <span>{doc.subject}</span>
                  <span>{doc.date}</span>
                  <span>{doc.size}</span>
                  <Link to="/library">Open</Link>
                </div>
              ))}
            </div>
          </article>

          <div className="student-dashboard__side">
            <article className="student-panel student-panel--compact">
              <h2>Continue Learning</h2>
              <div className="student-learning-list">
                {learningItems.map((item) => (
                  <Link className="student-learning-item" key={item.title} to="/library">
                    <span>⌘</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.time}</small>
                    </div>
                    <b>→</b>
                  </Link>
                ))}
              </div>
            </article>

            <article className="student-panel student-panel--compact">
              <h2>Your Subjects</h2>
              <div className="student-subjects">
                {subjects.map((subject) => (
                  <span key={subject}>{subject}</span>
                ))}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
