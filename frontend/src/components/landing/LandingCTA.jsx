import React from "react";
import { Link } from "react-router-dom";

export default function LandingCTA() {
  return (
    <section className="landing-cta">
      <h2>Start your academic journey today</h2>
      <p>Join students who are already using AI Study Hub to organize, search, and understand their courses.</p>
      <div>
        <Link className="landing-cta__primary" to="/login?mode=register">
          Sign up for free
        </Link>
        <a className="landing-cta__secondary" href="#courses">
          Learn more
        </a>
      </div>
    </section>
  );
}
