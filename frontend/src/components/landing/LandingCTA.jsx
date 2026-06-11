import React from "react";
import { Link } from "react-router-dom";

export default function LandingCTA() {
  return (
    <section className="px-6 py-20 md:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center md:px-16 md:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.45),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.25),transparent_40%)]"
        />

        <div className="relative mx-auto max-w-2xl">
          <h2 className="m-0 mb-4 text-balance text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Start your academic journey today
          </h2>
          <p className="m-0 text-balance text-base leading-relaxed text-slate-300 md:text-lg">
            Join students using AI Study Hub to organize course materials, discover shared resources,
            and study smarter.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-7 text-sm font-bold text-slate-900 no-underline transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              to="/login?mode=register"
            >
              Create free account
            </Link>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-7 text-sm font-bold text-white no-underline transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href="#courses"
            >
              Browse trending docs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
