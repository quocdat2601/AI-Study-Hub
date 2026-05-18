import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const homePath = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero__content">
          <p className="eyebrow">AI Study Hub</p>
          <h1>One place for every study file your class keeps losing.</h1>
          <p className="hero__copy">
            Store PDF and DOCX materials in a shared academic library, organize them by course, and prepare for
            document-grounded Gemini Q&A in the next build.
          </p>
          <div className="hero__actions">
            {isAuthenticated ? (
              <Link className="button button--primary" to={homePath}>
                Open workspace
              </Link>
            ) : (
              <>
                <Link className="button button--primary" to="/login">
                  Login
                </Link>
                <Link className="button button--secondary" to="/login?mode=register">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero__panel" aria-label="Study material preview">
          <div className="file-row">
            <span className="file-icon">PDF</span>
            <div>
              <strong>SWP391 Requirements</strong>
              <span>Software Engineering</span>
            </div>
          </div>
          <div className="file-row">
            <span className="file-icon file-icon--doc">DOC</span>
            <div>
              <strong>Database Notes</strong>
              <span>DBI202</span>
            </div>
          </div>
          <div className="ask-box">Ask Gemini: "Summarize the key acceptance criteria."</div>
        </div>
      </section>

      <section className="feature-grid" aria-label="Core features">
        <article>
          <h2>Central library</h2>
          <p>Students upload course materials to one cloud-backed system instead of hunting through chats.</p>
        </article>
        <article>
          <h2>Course control</h2>
          <p>Admins define subjects so documents stay organized around real classes.</p>
        </article>
        <article>
          <h2>Ready for AI Q&A</h2>
          <p>The system is shaped for text extraction and Gemini answers grounded in selected documents.</p>
        </article>
      </section>
    </main>
  );
}
