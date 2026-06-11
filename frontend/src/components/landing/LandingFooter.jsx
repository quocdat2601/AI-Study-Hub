import React from "react";
import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  { label: "About us", href: "#about" },
  { label: "Help Center", href: "#help" },
  { label: "Privacy Policy", href: "#privacy" },
  { label: "Terms of Service", href: "#terms" },
  { label: "Contact", href: "#contact" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#e2e8f0] bg-white px-5 py-12 md:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <Link className="text-xl font-bold text-[#4648d4] no-underline" to="/">
            AI Study Hub
          </Link>
          <p className="m-0 mt-3 max-w-[280px] text-sm leading-relaxed text-[#64748b]">
            Empowering academic excellence through shared study resources and AI-assisted learning.
          </p>
          <p className="m-0 mt-4 text-xs text-[#94a3b8]">© 2026 AI Study Hub. All rights reserved.</p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <a
              className="text-sm text-[#64748b] no-underline transition hover:text-[#4648d4]"
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
