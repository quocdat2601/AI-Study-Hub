import React from "react";
import CommunityAvatar from "./CommunityAvatar.jsx";
import { cx, formatCount, formatForumDate, getSafeText } from "./communityUtils.js";

function getBadgeToneClasses(tone) {
  const normalizedTone = getSafeText(tone, "slate").toLowerCase();

  const toneMap = {
    amber: "border-[#5f4313] bg-[#3b2a10] text-[#ffd67a]",
    blue: "border-[#21456f] bg-[#10253f] text-[#87c4ff]",
    emerald: "border-[#1f513e] bg-[#0f3024] text-[#7ee2b8]",
    pink: "border-[#69304d] bg-[#39172a] text-[#ff9ecf]",
    slate: "border-[#334155] bg-[#16202c] text-[#cdd8e5]",
    violet: "border-[#523884] bg-[#281a45] text-[#c7a6ff]",
  };

  return toneMap[normalizedTone] || toneMap.slate;
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 11l7.4-4.2" />
      <path d="M8.2 13l7.4 4.2" />
    </svg>
  );
}

function UpvoteIcon() {
  return (
    <svg className="h-4 w-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V6" />
      <path d="m6.5 11.5 5.5-5.5 5.5 5.5" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg className="h-4 w-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 8 4 12l5 4" />
      <path d="M20 18c0-4.418-3.582-8-8-8H4" />
    </svg>
  );
}

export default function CommunityThreadItem({
  as: Component = "article",
  className = "",
  post,
  isRootPost = false,
  attachmentSlot = null,
  onUpvote,
  onReply,
  onShare,
  LinkComponent = "a",
  variant = "dark",
  showTitle = true,
  showCreatedMeta = true,
  footerActionSlot = null,
}) {
  const safePost = post || {};
  const author = safePost.author || {};
  const metrics = safePost.metrics || {};
  const roleBadges = Array.isArray(author.roleBadges) ? author.roleBadges.filter((badge) => getSafeText(badge?.label)) : [];
  const displayName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous user");
  const profileHref = getSafeText(author.href || author.profileHref);
  const title = isRootPost ? getSafeText(safePost.title) : "";
  const content = getSafeText(safePost.content, "No content yet.");
  const itemIndex = Number.isFinite(Number(safePost.index)) ? `#${Number(safePost.index)}` : "#?";
  const ProfileComponent = profileHref ? LinkComponent : "div";
  const profileProps = profileHref ? (typeof ProfileComponent === "string" ? { href: profileHref } : { to: profileHref }) : {};
  const isLight = variant === "light";

  return (
    <Component
      className={cx(
        isLight
          ? "overflow-hidden rounded-[24px] border border-[#c7d2e2] bg-white text-[#172033] shadow-[0_18px_40px_rgba(20,31,48,0.06)]"
          : "overflow-hidden rounded-2xl border border-[#243142] bg-[#121a24] text-[#dbe5f1] shadow-[0_18px_48px_rgba(4,10,18,0.22)]",
        className
      )}
    >
      <div className="flex flex-col md:flex-row">
        <aside className={cx(
          "px-4 py-5 md:w-40 md:flex-none md:px-3",
          isLight
            ? "border-b border-[#dbe3ed] bg-[#f7f9fb] md:border-b-0 md:border-r"
            : "border-b border-[#243142] bg-[#0f1721] md:border-b-0 md:border-r"
        )}>
          <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
            <CommunityAvatar
              avatarUrl={getSafeText(author.avatarUrl)}
              displayName={displayName}
              email={author.email}
              variant={variant}
              className={cx(
                "h-16 w-16 flex-none rounded-full md:h-[84px] md:w-[84px]",
                isLight ? "border border-[#dbe3ed]" : "border border-[#2d3d51]"
              )}
            />

            <div className="min-w-0 flex-1 md:w-full">
              <ProfileComponent
                {...profileProps}
                className={cx(
                  isLight
                    ? "block truncate text-base font-extrabold text-[#172033] no-underline transition hover:text-[#4648d4]"
                    : "block truncate text-base font-extrabold text-[#f4f8fc] no-underline transition hover:text-[#89bfff]",
                  !profileHref && "pointer-events-none"
                )}
              >
                {displayName}
              </ProfileComponent>

              {roleBadges.length ? (
                <div className="mt-3 flex flex-wrap gap-2 md:justify-center">
                  {roleBadges.map((badge, index) => (
                    <span
                      className={cx(
                        "inline-flex min-h-6 items-center rounded-full border px-[9px] py-[3px] text-[11px] font-extrabold",
                        getBadgeToneClasses(badge.tone)
                      )}
                      key={`${badge.label}-${index}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <dl className={cx(
            "mt-5 grid gap-2 pt-4 text-[13px] leading-5",
            isLight ? "border-t border-[#dbe3ed] text-[#66758a]" : "border-t border-[#202c3b] text-[#95a6b8]"
          )}>
            <div className="flex items-center justify-between gap-3">
              <dt>Join date</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#172033]" : "text-[#edf4fb]")}>{formatForumDate(author.joinedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Post totals</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#172033]" : "text-[#edf4fb]")}>{formatCount(author.postCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Utility points</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#172033]" : "text-[#edf4fb]")}>{formatCount(author.utilityPoints)}</dd>
            </div>
          </dl>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={cx(
            "flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5",
            showCreatedMeta ? "justify-between" : "justify-end",
            isLight ? "border-b border-[#eef2f7]" : "border-b border-[#243142]"
          )}>
            {showCreatedMeta ? (
              <div className={cx(
                "flex min-w-0 items-center gap-2 text-sm",
                isLight ? "text-[#66758a]" : "text-[#94a5b8]"
              )}>
                <time className={cx("truncate font-semibold", isLight ? "text-[#172033]" : "text-[#dbe7f5]")}>{formatForumDate(safePost.createdAt, { includeTime: true })}</time>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                  isLight
                    ? "border-[#dbe3ed] bg-white text-[#66758a] hover:border-[#4648d4] hover:text-[#4648d4]"
                    : "border-[#2a394b] bg-[#16202c] text-[#a6bad0] hover:border-[#3d5570] hover:text-[#f4f8fc]"
                )}
                type="button"
                onClick={(event) => onShare?.(safePost, event)}
                aria-label={`Share post ${itemIndex}`}
              >
                <ShareIcon />
              </button>
              <span className={cx(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-black",
                isLight ? "border-[#dbe3ed] bg-[#f7f9fb] text-[#172033]" : "border-[#31445a] bg-[#172231] text-[#dbe7f5]"
              )}>
                {itemIndex}
              </span>
            </div>
          </header>

          <div className="flex min-h-[118px] flex-1 flex-col px-4 py-5 sm:px-5">
            <div className="flex-1">
              {title && showTitle ? <h1 className={cx("m-0 text-[28px] font-black leading-[1.2]", isLight ? "text-[#172033]" : "text-[#f5f8fc]")}>{title}</h1> : null}
              <div className={cx("text-[15px] leading-7", isLight ? "text-[#344154]" : "text-[#d1dae5]", title && showTitle && "mt-4")}>
                <p className="m-0 whitespace-pre-wrap break-words">{content}</p>
              </div>
            </div>

            {attachmentSlot ? (
              <section className={cx(
                "mt-5 rounded-xl border p-4",
                isLight ? "border-[#dbe3ed] bg-[#f8fafc]" : "border-[#26384b] bg-[#101722]"
              )}>
                <p className={cx("m-0 mb-3 text-xs font-black uppercase tracking-[0.8px]", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>Attachments</p>
                <div>{attachmentSlot}</div>
              </section>
            ) : null}
          </div>

          <footer className={cx(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5",
            isLight ? "border-t border-[#eef2f7] bg-[#fbfcfe]" : "border-t border-[#243142] bg-[#111924]"
          )}>
            <div className={cx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold",
              isLight ? "border-[#dbe3ed] bg-white text-[#172033]" : "border-[#2c3a4c] bg-[#16212d] text-[#dbe7f5]"
            )}>
              <UpvoteIcon />
              <span>{formatCount(metrics.upvoteCount)} upvotes</span>
            </div>

            <div className="flex items-center gap-2">
              {footerActionSlot}
              <button
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-black transition",
                  isLight
                    ? "border-[#dbe3ed] bg-white text-[#4648d4] hover:border-[#4648d4] hover:bg-[#eef2ff]"
                    : "border-[#2f4f78] bg-[#12243a] text-[#8dc6ff] hover:border-[#4c78a8] hover:bg-[#17304b]"
                )}
                type="button"
                onClick={(event) => onUpvote?.(safePost, event)}
              >
                <UpvoteIcon />
                <span>Upvote</span>
              </button>
              <button
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-black transition",
                  isLight
                    ? "border-[#dbe3ed] bg-white text-[#172033] hover:border-[#767586] hover:bg-[#f7f9fb]"
                    : "border-[#31445a] bg-[#16212d] text-[#dbe7f5] hover:border-[#4a627d] hover:bg-[#1a2836]"
                )}
                type="button"
                onClick={(event) => onReply?.(safePost, event)}
              >
                <ReplyIcon />
                <span>Reply</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Component>
  );
}
