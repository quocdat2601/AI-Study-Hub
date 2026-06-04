import React from "react";
import { Link } from "react-router-dom";

export default function LandingHeader({ isAuthenticated, workspacePath }) {
  return (
    <header className="landing-header">
      <Link className="landing-brand" to="/">
        AI Study Hub
      </Link>

      <div className="landing-header__center">
        <div className="landing-mini-search" aria-label="Search documents">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search for documents..." />
        </div>
        <Link to="/library">My Library</Link>
        <a href="#universities">Universities</a>
        <a href="#courses">Courses</a>
      </div>

      <div className="landing-header__actions">
        <button className="landing-icon-button" type="button" aria-label="Notifications">
          ♧
        </button>
        {isAuthenticated ? (
          <Link className="landing-button landing-button--outline" to={workspacePath}>
            Workspace
          </Link>
        ) : (
          <Link className="landing-button landing-button--outline" to="/login">
            Log in
          </Link>
        )}
        <Link className="landing-button landing-button--primary" to={isAuthenticated ? "/library" : "/login?mode=register"}>
          Upload
        </Link>
      </div>
    </header>
  );
}
