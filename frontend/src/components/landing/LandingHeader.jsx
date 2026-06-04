import React from "react";
import { Link, NavLink } from "react-router-dom";

export default function LandingHeader({ isAdmin = false, isAuthenticated, onLogout, showAppLinks = false, workspacePath }) {
  return (
    <header className={showAppLinks ? "landing-header landing-header--app" : "landing-header"}>
      <Link className="landing-brand" to="/">
        AI Study Hub
      </Link>

      <div className="landing-header__center">
        {showAppLinks ? <NavLink to="/dashboard">Community</NavLink> : null}
        {!showAppLinks ? (
          <div className="landing-mini-search" aria-label="Search documents">
            <span aria-hidden="true">S</span>
            <input type="search" placeholder="Search for documents..." />
          </div>
        ) : null}
        <NavLink to="/library">My Library</NavLink>
        <a href="#universities">Universities</a>
        <a href="#courses">Courses</a>
        {showAppLinks && isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
      </div>

      <div className="landing-header__actions">
        <button className="landing-icon-button" type="button" aria-label="Notifications">
          *
        </button>
        {showAppLinks ? (
          <button className="landing-button landing-button--outline" onClick={onLogout} type="button">
            Logout
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
