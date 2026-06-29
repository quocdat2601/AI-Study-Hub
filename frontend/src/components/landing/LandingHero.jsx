import React from "react";
import HeroSearch from "./HeroSearch.jsx";

const TRUST_POINTS = [
  "Shared by students",
  "Course-organized",
  "AI-ready previews",
];

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 md:px-8 md:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.14),transparent),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(59,130,246,0.08),transparent)]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="m-0 mb-5 inline-flex items-center rounded-full border border-indigo-100 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600 shadow-sm backdrop-blur-sm">
          Academic document library
        </p>

        <h1 className="mx-auto mb-5 max-w-[34rem] text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-5xl">
          Find study documents that help you pass your exams
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-balance text-lg leading-relaxed text-slate-500">
          Search course materials shared by your academic community, organize your library,
          and prepare for document-grounded AI support.
        </p>

        <HeroSearch />

        <ul className="m-0 mt-8 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-2 p-0">
          {TRUST_POINTS.map((point) => (
            <li className="flex items-center gap-2 text-sm font-medium text-slate-500" key={point}>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                ✓
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
