import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LandingCTA() {
  return (
    <section className="px-5 pb-20 pt-4 md:px-8">
      <div className="relative mx-auto w-full max-w-[1400px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#3f41c4] via-[#4648d4] to-[#5b6af8] shadow-[0_24px_60px_rgba(70,72,212,0.25)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-[#93b4fd]/25 blur-3xl"
        />

        <div className="relative grid items-center gap-10 px-8 py-12 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-14">
          <div className="text-left text-white">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Sparkles size={14} />
              Get started
            </p>
            <h2 className="m-0 text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-tight tracking-tight">
              Start your academic journey today
            </h2>
            <p className="m-0 mt-4 max-w-[520px] text-[16px] leading-relaxed text-white/90">
              Join students who are already using AI Study Hub to organize, search, and understand their courses.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <Link
              className="landing-btn-primary inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition"
              to="/login?mode=register"
            >
              Sign up for free
              <ArrowRight size={16} />
            </Link>
            <Link
              className="landing-btn-outline inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition"
              to="/ai-workspace"
            >
              Try AI Workspace
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
