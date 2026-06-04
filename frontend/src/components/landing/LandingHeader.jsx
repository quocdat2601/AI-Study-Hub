import React from "react";
import { Link } from "react-router-dom";

export default function LandingHeader({ isAuthenticated, isLoading = false, onLogout, workspacePath }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[#c7c4d7] bg-white px-4 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.05)] md:flex-nowrap md:px-8">
      <Link className="text-[#4648d4] text-xl font-extrabold no-underline whitespace-nowrap" to="/">
        AI Study Hub
      </Link>

      <nav className="order-3 flex min-w-0 flex-1 items-center justify-start gap-5 overflow-x-auto md:order-none md:justify-center md:gap-8 md:overflow-visible" aria-label="Primary navigation">
        <a className="text-[#57657a] text-sm font-bold no-underline whitespace-nowrap" href="#community">Community</a>
        <Link className="text-[#57657a] text-sm font-bold no-underline whitespace-nowrap" to={isAuthenticated ? "/dashboard" : workspacePath || "/dashboard"}>My Library</Link>
        <a className="text-[#57657a] text-sm font-bold no-underline whitespace-nowrap" href="#universities">Universities</a>
        <a className="text-[#57657a] text-sm font-bold no-underline whitespace-nowrap" href="#courses">Courses</a>
      </nav>

      <div className="flex items-center gap-3">
        <button className="inline-flex items-center justify-center bg-transparent border-0 text-[#57657a] cursor-pointer text-lg h-8 w-8" type="button" aria-label="Notifications">
          *
        </button>
        {isLoading ? (
          <span className="inline-flex min-h-[38px] w-[104px] animate-pulse rounded-full border border-[#c7c4d7] bg-[#eef2f8]" aria-label="Checking session" />
        ) : isAuthenticated ? (
          <button className="inline-flex items-center justify-center rounded-full text-sm font-extrabold min-h-[38px] px-6 bg-white border border-[#4648d4] text-[#4648d4] auth-btn-slide" onClick={onLogout} type="button">
            Log out
          </button>
        ) : (
          <Link className="inline-flex items-center justify-center rounded-full text-sm font-extrabold min-h-[38px] px-6 bg-white border border-[#4648d4] text-[#4648d4] no-underline whitespace-nowrap auth-btn-slide" to="/login">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
