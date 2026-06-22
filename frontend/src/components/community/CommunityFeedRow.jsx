import React from "react";
import CommunityAvatar from "./CommunityAvatar.jsx";
import { cx, formatCount, formatForumDate, getSafeText } from "./communityUtils.js";

function PostTypeTag({ postType }) {
  const map = {
    question: { label: "Question", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    discussion: { label: "Discussion", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    document_share: { label: "Document", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    ai_study_log: { label: "AI Log", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const entry = map[postType];
  if (!entry) return null;
  return (
    <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide", entry.cls)}>
      {entry.label}
    </span>
  );
}

function SolvedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10.28 2.28a.75.75 0 0 0-1.06-1.06L4.5 5.94 2.78 4.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l5.25-5.25Z" clipRule="evenodd" />
      </svg>
      Solved
    </span>
  );
}

export default function CommunityFeedRow({
  as: Component = "article",
  className = "",
  thread,
  LinkComponent = "a",
  footerSlot = null,
  showExcerpt = true,
}) {
  const safeThread = thread || {};
  const author = safeThread.author || {};
  const metrics = safeThread.metrics || {};
  const subjectList = Array.isArray(safeThread.subjects)
    ? safeThread.subjects.filter((subject) => getSafeText(subject?.code) || getSafeText(subject?.name))
    : [];
  const subject = safeThread.subject || subjectList[0] || {};
  const lastActivity = safeThread.lastActivity || {};
  const title = getSafeText(safeThread.title, "Untitled thread");
  const authorName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous");
  const authorId = author.id || null;
  const authorProfileHref = authorId ? `/community/users/${authorId}` : null;
  const titleHref = getSafeText(safeThread.href);
  const titleProps = titleHref ? (typeof LinkComponent === "string" ? { href: titleHref } : { to: titleHref }) : {};
  const lastActivityHref = getSafeText(lastActivity.href);
  const lastActivityName = getSafeText(lastActivity.userName) || getSafeText(lastActivity.email);
  const visibleSubjectList = subjectList.length
    ? subjectList
    : (getSafeText(subject.code) || getSafeText(subject.name) ? [subject] : []);
  const isSolved = Boolean(safeThread.isSolved);
  const AuthorLinkComponent = authorProfileHref ? LinkComponent : "span";
  const authorLinkProps = authorProfileHref
    ? (typeof AuthorLinkComponent === "string" ? { href: authorProfileHref } : { to: authorProfileHref })
    : {};

  return (
    <Component
      className={cx(
        "group relative overflow-hidden rounded-2xl border bg-white transition-all duration-150",
        "border-[#e8e4dc] hover:border-[#c9c4b8] hover:shadow-[0_4px_20px_rgba(26,20,10,0.08)]",
        className
      )}
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <AuthorLinkComponent
            {...authorLinkProps}
            className="flex-none no-underline"
            tabIndex={-1}
            aria-hidden="true"
          >
            <CommunityAvatar
              avatarUrl={getSafeText(author.avatarUrl)}
              displayName={authorName}
              email={author.email}
              variant="light"
              className="h-11 w-11 text-sm flex-none rounded-full border border-[#e8e4dc]"
            />
          </AuthorLinkComponent>

          <div className="min-w-0 flex-1">
            <div className="leading-snug mb-1">
              <span className="inline-flex flex-wrap items-center gap-1.5 mr-2 align-middle select-none">
                <PostTypeTag postType={safeThread.postType} />
                {isSolved ? <SolvedBadge /> : null}
                {visibleSubjectList.slice(0, 2).map((item) => (
                  <span
                    className="rounded-md bg-[#f0ece4] px-2 py-0.5 text-[11px] font-semibold text-[#6b5e4e]"
                    key={`${item.id || item.code}-${item.name || ""}`}
                  >
                    {getSafeText(item.code) || getSafeText(item.name)}
                  </span>
                ))}
              </span>

              {titleHref ? (
                <LinkComponent
                  {...titleProps}
                  className={cx(
                    "inline text-[17px] font-bold leading-snug no-underline transition-colors align-middle",
                    "text-[#1a1a2e] group-hover:text-[#4648d4]"
                  )}
                >
                  {title}
                </LinkComponent>
              ) : (
                <span className="inline text-[17px] font-bold leading-snug text-[#1a1a2e] align-middle">{title}</span>
              )}
            </div>

            {showExcerpt && safeThread.postType !== "document_share" && safeThread.postType !== "ai_study_log" && getSafeText(safeThread.excerpt) ? (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#6b6660]">{safeThread.excerpt}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#8a8278]">
                <AuthorLinkComponent
                  {...authorLinkProps}
                  className="font-semibold text-[#4a4640] no-underline transition hover:text-[#4648d4] hover:underline"
                >
                  {authorName}
                </AuthorLinkComponent>
                {author.utilityPoints ? (
                  <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-bold text-[#5b21b6]">
                    ↑ {formatCount(author.utilityPoints)} pts
                  </span>
                ) : null}
                <span className="text-[#b8b2aa]">·</span>
                <span>{formatForumDate(safeThread.createdAt)}</span>
                {lastActivityName && getSafeText(lastActivity.at) && lastActivityName !== authorName ? (
                  <>
                    <span className="text-[#b8b2aa]">·</span>
                    <span>
                      last reply by{" "}
                      {lastActivityHref ? (
                        <LinkComponent
                          {...(typeof LinkComponent === "string" ? { href: lastActivityHref } : { to: lastActivityHref })}
                          className="font-semibold text-[#4a4640] no-underline hover:text-[#4648d4] hover:underline transition"
                        >
                          {lastActivityName}
                        </LinkComponent>
                      ) : (
                        <span className="font-semibold">{lastActivityName}</span>
                      )}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-4 text-[13px] text-[#8a8278]">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 19V6"/><path d="m6.5 11.5 5.5-5.5 5.5 5.5"/>
                  </svg>
                  <span className="font-semibold">{formatCount(metrics.upvoteCount ?? metrics.voteCount)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 8 4 12l5 4"/><path d="M20 18c0-4.418-3.582-8-8-8H4"/>
                  </svg>
                  <span className="font-semibold">{formatCount(metrics.replyCount)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span className="font-semibold">{formatCount(metrics.viewCount)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {footerSlot ? (
        <div className="border-t border-[#f0ece4] bg-[#faf9f7] px-5 py-3">
          {footerSlot}
        </div>
      ) : null}
    </Component>
  );
}
