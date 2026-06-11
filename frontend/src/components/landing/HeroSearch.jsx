import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/documents?q=${encodeURIComponent(trimmed)}` : "/documents");
  }

  return (
    <form
      className="mx-auto flex w-full max-w-[900px] items-center gap-3 rounded-2xl border border-[#dbeafe] bg-white p-2.5 shadow-[0_20px_50px_rgba(70,72,212,0.12)]"
      onSubmit={handleSubmit}
      role="search"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center text-[#64748b]" aria-hidden="true">
        <Search size={24} />
      </span>
      <input
        aria-label="Search study documents"
        className="min-h-14 w-full border-0 bg-transparent text-[18px] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for your course, book or school..."
        value={query}
      />
      <button
        className="shrink-0 rounded-xl bg-[#4648d4] px-8 py-3.5 text-[16px] font-semibold text-white transition hover:bg-[#3b3dc4]"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
