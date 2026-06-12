import React, { useEffect, useRef, useState } from "react";
import CommunityAvatar from "./CommunityAvatar.jsx";
import { cx, formatCount, formatForumDate, getCommunityBadgeToneClasses, getSafeText } from "./communityUtils.js";

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

function MoreIcon() {
  return (
    <svg className="h-4 w-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}

function ThreadItemMenu({ items, isLight }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
          isLight
            ? "border-[#dbe3ed] bg-white text-[#66758a] hover:border-[#4648d4] hover:text-[#4648d4]"
            : "border-[#2a394b] bg-[#16202c] text-[#a6bad0] hover:border-[#3d5570] hover:text-[#f4f8fc]"
        )}
        type="button"
        aria-label="More actions"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreIcon />
      </button>

      {isOpen ? (
        <div className={cx(
          "absolute right-0 top-[calc(100%+8px)] z-20 min-w-[180px] overflow-hidden rounded-2xl border shadow-[0_24px_45px_rgba(8,13,22,0.18)]",
          isLight ? "border-[#dbe3ed] bg-white" : "border-[#334154] bg-[#101722]"
        )}>
          <div className="grid py-2">
            {items.map((item) => (
              <button
                key={item.id || item.label}
                className={cx(
                  "px-4 py-3 text-left text-sm font-bold transition",
                  isLight ? "text-[#172033] hover:bg-[#f8fafc]" : "text-white hover:bg-[rgba(255,255,255,0.08)]",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setIsOpen(false);
                  item.onClick?.();
                }}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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
  menuItems = [],
  LinkComponent = "a",
  variant = "dark",
  showTitle = true,
  showCreatedMeta = true,
  footerActionSlot = null,
  onParentReplyClick,
  isHighlighted = false,
}) {
  const safePost = post || {};
  const author = safePost.author || {};
  const metrics = safePost.metrics || {};
  const roleBadges = Array.isArray(author.roleBadges) ? author.roleBadges.filter((badge) => getSafeText(badge?.label)) : [];
  const displayName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous user");
  const profileHref = getSafeText(author.href || author.profileHref);
  const title = isRootPost ? getSafeText(safePost.title) : "";
  const content = getSafeText(safePost.content, "No content yet.");
  const parentReply = safePost.parentReply || null;
  const parentReplyId = safePost.parentReplyId || parentReply?.id || null;
  const parentReplyIndex = Number.isFinite(Number(safePost.parentReplyIndex)) ? `#${Number(safePost.parentReplyIndex)}` : "";
  const parentReplyAuthor = getSafeText(parentReply?.author?.displayName) || getSafeText(parentReply?.author?.email);
  const parentReplyExcerpt = getSafeText(parentReply?.excerpt);
  const itemIndex = Number.isFinite(Number(safePost.index)) ? `#${Number(safePost.index)}` : "#?";
  const anchorId = safePost.id ? `${isRootPost ? "community-post" : "community-reply"}-${safePost.id}` : undefined;
  const ProfileComponent = profileHref ? LinkComponent : "div";
  const profileProps = profileHref ? (typeof ProfileComponent === "string" ? { href: profileHref } : { to: profileHref }) : {};
  const isLight = variant === "light";
  const isAccepted = Boolean(safePost.isAccepted);
  const isUpvoted = Boolean(safePost.isUpvoted);

  return (
    <Component
      id={anchorId}
      className={cx(
        isLight
          ? (isAccepted
            ? "scroll-mt-24 overflow-hidden rounded-[24px] border border-[#9fd6b8] bg-[#fcfffd] text-[#172033] shadow-[0_20px_48px_rgba(22,101,52,0.10)]"
            : "scroll-mt-24 overflow-hidden rounded-[24px] border border-[#c7d2e2] bg-white text-[#172033] shadow-[0_18px_40px_rgba(20,31,48,0.06)]")
          : "scroll-mt-24 overflow-hidden rounded-2xl border border-[#243142] bg-[#121a24] text-[#dbe5f1] shadow-[0_18px_48px_rgba(4,10,18,0.22)]",
        isHighlighted && (isLight
          ? "border-[#8ea2ff] shadow-[0_0_0_4px_rgba(70,72,212,0.14),0_18px_40px_rgba(20,31,48,0.10)]"
          : "border-[#6f89ff] shadow-[0_0_0_4px_rgba(111,137,255,0.18),0_18px_48px_rgba(4,10,18,0.28)]"),
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
                        getCommunityBadgeToneClasses(badge.tone, "dark")
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
              <ThreadItemMenu items={menuItems} isLight={isLight} />
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
              {parentReplyId ? (
                <div className={cx(
                  "mb-4 rounded-2xl border px-4 py-3 text-sm",
                  isLight ? "border-[#dbe3ed] bg-[#f8fafc] text-[#526173]" : "border-[#26384b] bg-[#101722] text-[#c2d0df]",
                  title && showTitle ? "mt-4" : ""
                )}>
                  <button
                    className={cx(
                      "m-0 inline-flex items-center gap-2 border-0 bg-transparent p-0 text-left text-sm font-black transition",
                      isLight ? "text-[#172033] hover:text-[#4648d4]" : "text-white hover:text-[#8dc6ff]",
                      !onParentReplyClick && "pointer-events-none"
                    )}
                    onClick={() => onParentReplyClick?.(safePost)}
                    type="button"
                  >
                    <span>
                      Replying to {parentReplyAuthor || "deleted comment"}
                      {parentReplyIndex ? ` · ${parentReplyIndex}` : ""}
                    </span>
                  </button>
                  {parentReplyExcerpt ? <p className="mt-1 mb-0 line-clamp-2 whitespace-pre-wrap break-words">{parentReplyExcerpt}</p> : null}
                </div>
              ) : null}
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
            isLight
              ? (isAccepted ? "border-t border-[#d9efe3] bg-[#f4fff8]" : "border-t border-[#eef2f7] bg-[#fbfcfe]")
              : "border-t border-[#243142] bg-[#111924]"
          )}>
            <div className={cx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold",
              isLight
                ? (isUpvoted ? "border-[#bfd0ff] bg-[#eef2ff] text-[#4648d4]" : "border-[#dbe3ed] bg-white text-[#172033]")
                : "border-[#2c3a4c] bg-[#16212d] text-[#dbe7f5]"
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
                    ? (isUpvoted
                      ? "border-[#bfd0ff] bg-[#eef2ff] text-[#4648d4] hover:border-[#aabfff] hover:bg-[#e6ecff]"
                      : "border-[#dbe3ed] bg-white text-[#4648d4] hover:border-[#4648d4] hover:bg-[#eef2ff]")
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
