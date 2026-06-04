import React from "react";
import { Link } from "react-router-dom";

export default function LandingCTA() {
  return (
    <section className="flex flex-col items-center bg-[#4648d4] text-white px-6 py-16 text-center">
      <h2 className="text-[28px] leading-[1.28] tracking-normal m-0 mb-4">Start your academic journey today</h2>
      <p className="leading-[1.5] m-0 max-w-[720px] opacity-90">Join students who are already using AI Study Hub to organize, search, and understand their courses.</p>
      <div className="flex gap-4 justify-center mt-8">
        <Link className="rounded-full text-sm font-extrabold min-w-36 px-7 py-[13px] no-underline bg-white text-[#4648d4]" to="/login?mode=register">
          Sign up for free
        </Link>
        <a className="rounded-full text-sm font-extrabold min-w-36 px-7 py-[13px] no-underline border border-white/30 text-white" href="#courses">
          Learn more
        </a>
      </div>
    </section>
  );
}
