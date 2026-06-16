import React from "react";

const FOOTER_LINKS = [
  { label: "About", href: "#about" },
  { label: "Help center", href: "#help" },
  { label: "Privacy", href: "#privacy" },
  { label: "Terms", href: "#terms" },
  { label: "Contact", href: "#contact" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white px-6 py-12 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-extrabold text-white">
              AI
            </span>
            <strong className="text-base font-extrabold text-slate-900">Study Hub</strong>
          </div>
          <p className="m-0 text-sm leading-relaxed text-slate-500">
            A shared academic library for students to discover, organize, and learn from course documents.
          </p>
          <p className="mb-0 mt-4 text-xs text-slate-400">© 2026 AI Study Hub. All rights reserved.</p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer navigation">
          {FOOTER_LINKS.map((link) => (
            <a
              className="text-sm font-medium text-slate-500 no-underline transition hover:text-indigo-600"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
