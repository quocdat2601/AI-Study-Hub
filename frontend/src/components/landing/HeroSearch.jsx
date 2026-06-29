import React from "react";
import { useNavigate } from "react-router-dom";

export default function HeroSearch() {
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") || "").trim();
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    navigate(`/documents${params}`);
  }

  return (
    <form
      className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-2 shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 sm:flex-row sm:items-center"
      onSubmit={handleSubmit}
      role="search"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          aria-label="Search study documents"
          className="min-h-12 w-full border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          name="q"
          placeholder="Search by course, title, or subject code..."
          type="search"
        />
      </div>
      <button
        className="min-h-12 shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-8 text-sm font-bold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
