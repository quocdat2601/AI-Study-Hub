import React from "react";

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div>
        <strong>AI Study Hub</strong>
        <span>© 2026 AI Study Hub. Empowering academic excellence.</span>
      </div>
      <nav aria-label="Footer navigation">
        <a href="#about">About us</a>
        <a href="#help">Help Center</a>
        <a href="#privacy">Privacy Policy</a>
        <a href="#terms">Terms of Service</a>
        <a href="#contact">Contact</a>
      </nav>
      <div className="landing-footer__socials" aria-label="Social links">
        <a href="#community" aria-label="Community">
          ●
        </a>
        <a href="#share" aria-label="Share">
          ↗
        </a>
      </div>
    </footer>
  );
}
