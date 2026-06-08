import React from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../NotificationBell.jsx";

export default function LandingHeader({ isAuthenticated, isLoading = false, onLogout, workspacePath }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#c7c4d7] bg-white px-4 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950 md:flex-nowrap md:px-8">
      <Link className="whitespace-nowrap text-xl font-extrabold text-[#4648d4] no-underline dark:text-indigo-400" to="/">
        AI Study Hub
      </Link>

      <nav className="order-3 flex min-w-0 flex-1 items-center justify-start gap-5 overflow-x-auto md:order-none md:justify-center md:gap-8 md:overflow-visible" aria-label="Primary navigation">
        <a className="whitespace-nowrap text-sm font-bold text-[#57657a] no-underline dark:text-slate-400" href="#community">Community</a>
        <Link className="whitespace-nowrap text-sm font-bold text-[#57657a] no-underline dark:text-slate-400" to={isAuthenticated ? "/documents" : workspacePath || "/dashboard"}>My Documents</Link>
        <a className="whitespace-nowrap text-sm font-bold text-[#57657a] no-underline dark:text-slate-400" href="#universities">Universities</a>
        <a className="whitespace-nowrap text-sm font-bold text-[#57657a] no-underline dark:text-slate-400" href="#courses">Courses</a>
      </nav>

      <div className="flex items-center gap-3">
        {isAuthenticated ? <NotificationBell /> : null}
        {isLoading ? (
          <span className="inline-flex min-h-[38px] w-[104px] animate-pulse rounded-full border border-[#c7c4d7] bg-[#eef2f8] dark:border-slate-700 dark:bg-slate-800" aria-label="Checking session" />
        ) : isAuthenticated ? (
          <button className="auth-btn-slide inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#4648d4] bg-white px-6 text-sm font-extrabold text-[#4648d4] dark:border-indigo-500 dark:bg-slate-900 dark:text-indigo-300" onClick={onLogout} type="button">
            Log out
          </button>
        ) : (
          <Link className="auth-btn-slide inline-flex min-h-[38px] items-center justify-center whitespace-nowrap rounded-full border border-[#4648d4] bg-white px-6 text-sm font-extrabold text-[#4648d4] no-underline dark:border-indigo-500 dark:bg-slate-900 dark:text-indigo-300" to="/login">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
