import React from "react";
import { BookOpen, Sparkles, Users } from "lucide-react";
import HeroSearch from "./HeroSearch.jsx";

const STATS = [
  { icon: BookOpen, label: "Shared documents", value: "1,200+" },
  { icon: Users, label: "Active students", value: "480+" },
  { icon: Sparkles, label: "AI-assisted study", value: "24/7" },
];

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b border-[#e2e8f0] bg-gradient-to-b from-white via-[#f8faff] to-[#f4f6fa] px-6 pb-24 pt-14 md:px-10 md:pb-28 md:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-[#4648d4]/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-[#93b4fd]/15 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-[1400px]">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c7d2fe] bg-white px-5 py-2 text-[15px] font-semibold text-[#4648d4] shadow-sm">
            <Sparkles size={16} />
            Academic document platform
          </p>

          <h1 className="mx-auto mb-6 max-w-[1000px] text-balance text-[clamp(2.25rem,4.5vw,3.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[#0f172a]">
            Find the best study documents to pass your exams with flying colours
          </h1>

          <p className="mx-auto mb-12 max-w-[760px] text-pretty text-[clamp(1.05rem,1.8vw,1.25rem)] leading-relaxed text-[#64748b]">
            Access shared study resources from your academic community, organize course materials,
            and prepare for document-grounded AI support.
          </p>

          <HeroSearch />
        </div>

        <div className="mx-auto mt-16 grid max-w-[1200px] gap-5 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, label, value }) => (
            <div
              className="rounded-2xl border border-[#e2e8f0] bg-white px-6 py-6 text-left shadow-[0_10px_36px_rgba(15,23,42,0.06)]"
              key={label}
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4648d4]">
                <Icon size={22} />
              </span>
              <p className="m-0 text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-tight text-[#0f172a]">
                {value}
              </p>
              <p className="m-0 mt-2 text-[15px] font-medium text-[#64748b]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
