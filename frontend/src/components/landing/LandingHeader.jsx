import React from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../NotificationBell.jsx";

const NAV_LINK =
  "rounded-xl px-4 py-2.5 text-[16px] font-medium text-[#475569] no-underline transition hover:bg-[#eef2ff] hover:text-[#4648d4]";

export default function LandingHeader({ isAuthenticated, isLoading = false, onLogout, workspacePath }) {
  const libraryPath = workspacePath || "/dashboard";
  const libraryLabel = isAuthenticated && libraryPath === "/admin" ? "Dashboard" : "My Library";

  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white px-6 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md md:px-10 md:py-5">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6">
        <Link
          className="shrink-0 text-[26px] font-bold tracking-tight text-[#4648d4] no-underline md:text-[30px]"
          to="/"
        >
          AI Study Hub
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 lg:flex" aria-label="Primary navigation">
          <Link className={NAV_LINK} to={libraryPath}>{libraryLabel}</Link>
          <Link className={NAV_LINK} to={isAuthenticated ? "/documents" : "/login"}>My Documents</Link>
          <Link className={NAV_LINK} to={isAuthenticated ? "/workspace" : "/login"}>Workspace</Link>
          <a className={NAV_LINK} href="#trending">Trending</a>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {isAuthenticated ? <NotificationBell /> : null}
          {isLoading ? (
            <span
              aria-label="Checking session"
              className="inline-flex h-12 w-28 animate-pulse rounded-full bg-[#e2e8f0]"
            />
          ) : isAuthenticated && onLogout ? (
            <button
              className="rounded-full border-2 border-[#4648d4] bg-white px-6 py-2.5 text-[15px] font-semibold text-[#4648d4] transition hover:bg-[#4648d4] hover:text-white"
              onClick={onLogout}
              type="button"
            >
              Log out
            </button>
          ) : (
            <Link
              className="rounded-full bg-[#4648d4] px-7 py-3 text-[15px] font-semibold text-white no-underline shadow-[0_10px_28px_rgba(70,72,212,0.32)] transition hover:bg-[#3b3dc4]"
              style={{ color: "#ffffff" }}
              to="/login"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
