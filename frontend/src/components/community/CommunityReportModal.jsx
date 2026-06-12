import React from "react";
import { getSafeText } from "./communityUtils.js";

export default function CommunityReportModal({
  isOpen,
  target,
  reason,
  error,
  isSubmitting,
  onReasonChange,
  onClose,
  onSubmit,
}) {
  if (!isOpen || !target) return null;

  const isReply = target.type === "reply";
  const summary = getSafeText(target.summary, isReply ? "Comment" : "Post");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.58)] px-4" role="dialog" aria-modal="true" aria-labelledby="community-report-title">
      <div className="w-full max-w-lg rounded-[28px] border border-[#dbe3ed] bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#66758a]">
          {isReply ? "Report Comment" : "Report Post"}
        </p>
        <h2 className="mt-3 mb-0 text-[28px] font-extrabold leading-[1.05] text-[#172033]" id="community-report-title">
          Flag this {isReply ? "comment" : "post"} for review
        </h2>
        <p className="mt-4 mb-0 text-sm leading-6 text-[#526173]">
          Give a short reason so moderators understand what needs review.
        </p>

        <div className="mt-5 rounded-[20px] border border-[#dbe3ed] bg-[#f8fafc] px-4 py-3">
          <p className="m-0 text-xs font-black uppercase tracking-[0.08em] text-[#66758a]">
            {isReply ? "Comment summary" : "Post summary"}
          </p>
          <p className="mt-2 mb-0 text-sm leading-6 text-[#344154]">{summary}</p>
        </div>

        <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#66758a]">Reason</span>
            <textarea
              className="min-h-[150px] w-full resize-y rounded-[22px] border border-[#dbe3ed] bg-[#f8fafc] px-4 py-3 text-[15px] leading-7 text-[#172033] outline-none transition placeholder:text-[#7a8798] focus:border-[#4648d4] focus:bg-white focus:shadow-[0_0_0_4px_rgba(70,72,212,0.12)]"
              placeholder="Explain what is wrong with this content."
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm font-bold text-[#991b1b]">
              {error}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#dbe3ed] px-5 text-sm font-black text-[#172033]"
              onClick={onClose}
              type="button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#172033] bg-[#172033] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:border-[#c7d2e2] disabled:bg-[#e5e7eb] disabled:text-[#7f95ac]"
              type="submit"
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
