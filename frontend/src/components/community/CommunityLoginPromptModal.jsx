import React from "react";
import { Link } from "react-router-dom";

export default function CommunityLoginPromptModal({ isOpen, onClose, loginTarget }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.58)] px-4" role="dialog" aria-modal="true" aria-labelledby="community-compose-login-title">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#66758a]">Login Required</p>
        <h2 className="mt-3 mb-0 text-[28px] font-extrabold leading-[1.05] text-[#172033]" id="community-compose-login-title">
          Sign in to publish to the community
        </h2>
        <p className="mt-4 mb-0 text-sm leading-6 text-[#526173]">
          Your course context and post type will still be waiting for you after login.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[#172033] px-5 py-3 text-sm font-extrabold text-white no-underline"
            state={{ from: loginTarget }}
            to="/login"
          >
            Continue to login
          </Link>
          <button className="inline-flex items-center justify-center rounded-full border border-[#dbe3ed] px-5 py-3 text-sm font-extrabold text-[#172033]" onClick={onClose} type="button">
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
