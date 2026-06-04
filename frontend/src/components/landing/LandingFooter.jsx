import React from "react";

export default function LandingFooter() {
  return (
    <footer className="grid grid-cols-[1fr_auto_auto] items-center gap-6 bg-[#f2f4f6] border-t border-[#c7c4d7] p-8">
      <div>
        <strong className="block text-xl mb-2">AI Study Hub</strong>
        <span className="block text-[#464554] text-xs">© 2026 AI Study Hub. Empowering academic excellence.</span>
      </div>
      <nav className="flex gap-6" aria-label="Footer navigation">
        <a className="text-[#464554] text-xs no-underline" href="#about">About us</a>
        <a className="text-[#464554] text-xs no-underline" href="#help">Help Center</a>
        <a className="text-[#464554] text-xs no-underline" href="#privacy">Privacy Policy</a>
        <a className="text-[#464554] text-xs no-underline" href="#terms">Terms of Service</a>
        <a className="text-[#464554] text-xs no-underline" href="#contact">Contact</a>
      </nav>
      <div className="flex gap-4" aria-label="Social links">
        <a className="inline-flex items-center justify-center bg-[rgba(199,196,215,0.2)] rounded-full h-8 w-8 no-underline" href="#community" aria-label="Community">
          ●
        </a>
        <a className="inline-flex items-center justify-center bg-[rgba(199,196,215,0.2)] rounded-full h-8 w-8 no-underline" href="#share" aria-label="Share">
          ↗
        </a>
      </div>
    </footer>
  );
}
