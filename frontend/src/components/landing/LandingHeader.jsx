import React from "react";
import { Link, useLocation } from "react-router-dom";
import NotificationBell from "../NotificationBell.jsx";

function NavLink({ to, href, children, isActive = false }) {
  const className = `no-caret whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold no-underline transition ${
    isActive
      ? "bg-indigo-50 text-indigo-700"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;

  if (to) {
    return (
      <Link className={className} to={to}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export default function LandingHeader({ isAuthenticated, isLoading = false, onLogout, workspacePath }) {
  const location = useLocation();
  const libraryPath = workspacePath || "/dashboard";
  const libraryLabel = isAuthenticated && libraryPath === "/admin" ? "Dashboard" : "My library";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 md:px-8">
        <Link className="no-caret flex items-center gap-2.5 whitespace-nowrap no-underline" to="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)]">
            AI
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">Study Hub</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          <NavLink isActive={location.pathname === libraryPath} to={libraryPath}>
            {libraryLabel}
          </NavLink>
          <NavLink
            isActive={location.pathname === "/documents"}
            to={isAuthenticated ? "/documents" : workspacePath || "/dashboard"}
          >
            My documents
          </NavLink>
          <NavLink href="#universities">Universities</NavLink>
          <NavLink href="#courses" isActive={location.pathname === "/" && location.hash === "#courses"}>
            Courses
          </NavLink>
        </nav>

        <div className="flex items-center gap-2.5">
          {isAuthenticated ? <NotificationBell /> : null}
          {isLoading ? (
            <span
              className="inline-flex h-10 w-24 animate-pulse rounded-xl bg-slate-100"
              aria-label="Checking session"
            />
          ) : isAuthenticated && onLogout ? (
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onLogout}
              type="button"
            >
              Log out
            </button>
          ) : (
            <>
              <Link
                className="no-caret hidden h-10 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 no-underline transition hover:bg-slate-50 sm:inline-flex"
                to="/login"
              >
                Log in
              </Link>
              <Link
                className="no-caret inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white no-underline shadow-[0_4px_14px_rgba(79,70,229,0.28)] transition hover:bg-indigo-700"
                to="/login?mode=register"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
