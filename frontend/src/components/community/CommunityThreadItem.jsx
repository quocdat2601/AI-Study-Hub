import React, { useEffect, useRef, useState } from "react";
import CommunityAvatar from "./CommunityAvatar.jsx";
import { cx, formatCount, formatForumDate, getCommunityBadgeToneClasses, getSafeText, renderMarkdownBody } from "./communityUtils.js";

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
  const [activeImageUrl, setActiveImageUrl] = useState(null);
  const safePost = post || {};
  const author = safePost.author || {};
  const metrics = safePost.metrics || {};
  const roleBadges = Array.isArray(author.roleBadges) ? author.roleBadges.filter((badge) => getSafeText(badge?.label)) : [];
  const displayName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous user");
  const authorId = author.id || null;
  const profileHref = authorId ? `/community/users/${authorId}` : getSafeText(author.href || author.profileHref);
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
            ? "scroll-mt-24 overflow-hidden rounded-2xl border border-[#a3d8b8] bg-[#fbfdfa] text-[#1a1a2e] shadow-[0_12px_24px_rgba(21,128,61,0.05)]"
            : "scroll-mt-24 overflow-hidden rounded-2xl border border-[#e4e0d8] bg-white text-[#1a1a2e] shadow-sm")
          : "scroll-mt-24 overflow-hidden rounded-2xl border border-[#243142] bg-[#121a24] text-[#dbe5f1] shadow-[0_18px_48px_rgba(4,10,18,0.22)]",
        isHighlighted && (isLight
          ? "border-[#4648d4] shadow-[0_0_0_4px_rgba(70,72,212,0.12),0_12px_24px_rgba(20,31,48,0.08)]"
          : "border-[#6f89ff] shadow-[0_0_0_4px_rgba(111,137,255,0.18),0_18px_48px_rgba(4,10,18,0.28)]"),
        className
      )}
    >
      <div className="flex flex-col md:flex-row">
        <aside className={cx(
          "px-4 py-6 md:w-44 md:flex-none md:px-4",
          isLight
            ? "border-b border-[#e8e4dc] bg-[#faf8f5] md:border-b-0 md:border-r"
            : "border-b border-[#243142] bg-[#0f1721] md:border-b-0 md:border-r"
        )}>
          <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
            <CommunityAvatar
              avatarUrl={getSafeText(author.avatarUrl)}
              displayName={displayName}
              email={author.email}
              variant={variant}
              className={cx(
                "h-14 w-14 flex-none rounded-full md:h-20 md:w-20",
                isLight ? "border border-[#e8e4dc]" : "border border-[#2d3d51]"
              )}
            />

            <div className="min-w-0 flex-1 md:w-full">
              <ProfileComponent
                {...profileProps}
                className={cx(
                  isLight
                    ? "block truncate text-sm font-bold text-[#1a1a2e] no-underline transition hover:text-[#4648d4]"
                    : "block truncate text-sm font-bold text-[#f4f8fc] no-underline transition hover:text-[#89bfff]",
                  !profileHref && "pointer-events-none"
                )}
              >
                {displayName}
              </ProfileComponent>

              {roleBadges.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1 md:justify-center">
                  {roleBadges.map((badge, index) => (
                    <span
                      className={cx(
                        "inline-flex min-h-5 items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        getCommunityBadgeToneClasses(badge.tone, "light")
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
            "mt-5 grid gap-2 pt-4 text-[12px] leading-5",
            isLight ? "border-t border-[#e8e4dc] text-[#6b6660]" : "border-t border-[#202c3b] text-[#95a6b8]"
          )}>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-[#8c857e]">Joined</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#1a1a2e]" : "text-[#edf4fb]")}>{formatForumDate(author.joinedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-[#8c857e]">Posts</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#1a1a2e]" : "text-[#edf4fb]")}>{formatCount(author.postCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-[#8c857e]">Reputation</dt>
              <dd className={cx("m-0 font-bold", isLight ? "text-[#1a1a2e]" : "text-[#edf4fb]")}>{formatCount(author.utilityPoints)}</dd>
            </div>
          </dl>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className={cx(
            "flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5",
            showCreatedMeta ? "justify-between" : "justify-end",
            isLight ? "border-b border-[#e8e4dc]" : "border-b border-[#243142]"
          )}>
            {showCreatedMeta ? (
              <div className={cx(
                "flex min-w-0 items-center gap-2 text-sm",
                isLight ? "text-[#6b6660]" : "text-[#94a5b8]"
              )}>
                <time className={cx("truncate font-semibold", isLight ? "text-[#1a1a2e]" : "text-[#dbe7f5]")}>{formatForumDate(safePost.createdAt, { includeTime: true })}</time>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <ThreadItemMenu items={menuItems} isLight={isLight} />
              <button
                className={cx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
                  isLight
                    ? "border-[#e8e4dc] bg-white text-[#6b6660] hover:border-[#4648d4] hover:text-[#4648d4] hover:bg-[#faf8f5]"
                    : "border-[#2a394b] bg-[#16202c] text-[#a6bad0] hover:border-[#3d5570] hover:text-[#f4f8fc]"
                )}
                type="button"
                onClick={(event) => onShare?.(safePost, event)}
                aria-label={`Share post ${itemIndex}`}
              >
                <ShareIcon />
              </button>
              <span className={cx(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold",
                isLight ? "border-[#e8e4dc] bg-[#f0ece4] text-[#6b6660]" : "border-[#31445a] bg-[#172231] text-[#dbe7f5]"
              )}>
                {itemIndex}
              </span>
            </div>
          </header>

          <div className="flex min-h-[118px] flex-1 flex-col px-4 py-5 sm:px-5">
            <div className="flex-1">
              {title && showTitle ? <h1 className={cx("m-0 text-2xl font-extrabold tracking-tight leading-tight", isLight ? "text-[#1a1a2e]" : "text-[#f5f8fc]")}>{title}</h1> : null}
              {parentReplyId ? (
                <div className={cx(
                  "mb-4 rounded-xl border px-4 py-3 text-sm",
                  isLight ? "border-[#e8e4dc] bg-[#faf8f5] text-[#6b6660]" : "border-[#26384b] bg-[#101722] text-[#c2d0df]",
                  title && showTitle ? "mt-4" : ""
                )}>
                  <button
                    className={cx(
                      "m-0 inline-flex items-center gap-2 border-0 bg-transparent p-0 text-left text-sm font-bold transition",
                      isLight ? "text-[#1a1a2e] hover:text-[#4648d4]" : "text-white hover:text-[#8dc6ff]",
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
              <div className={cx("text-[15px] leading-7", isLight ? "text-[#2e2a25]" : "text-[#d1dae5]", title && showTitle && "mt-4")}>
                <div className="m-0 whitespace-pre-wrap break-words">{renderMarkdownBody(content, React, setActiveImageUrl)}</div>
              </div>
            </div>

            {attachmentSlot ? (
              <section className={cx(
                "mt-5 rounded-xl border p-4",
                isLight ? "border-[#e8e4dc] bg-[#faf8f5]" : "border-[#26384b] bg-[#101722]"
              )}>
                <p className={cx("m-0 mb-3 text-[10px] font-bold uppercase tracking-[0.8px]", isLight ? "text-[#6b6660]" : "text-[#7f96ad]")}>Attachments</p>
                <div>{attachmentSlot}</div>
              </section>
            ) : null}
          </div>

          <footer className={cx(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5",
            isLight
              ? (isAccepted ? "border-t border-[#a3d8b8] bg-[#f4fcf7]" : "border-t border-[#e8e4dc] bg-[#faf8f5]")
              : "border-t border-[#243142] bg-[#111924]"
          )}>
            <div className={cx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
              isLight
                ? (isUpvoted ? "border-[#bfd0ff] bg-[#ede9fe] text-[#4648d4]" : "border-[#e8e4dc] bg-white text-[#6b6660]")
                : "border-[#2c3a4c] bg-[#16212d] text-[#dbe7f5]"
            )}>
              <UpvoteIcon />
              <span>{formatCount(metrics.upvoteCount)} upvotes</span>
            </div>

            <div className="flex items-center gap-2">
              {footerActionSlot}
              <button
                className={cx(
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-xs font-bold transition",
                  isLight
                    ? (isUpvoted
                      ? "border-[#bfd0ff] bg-[#ede9fe] text-[#4648d4] hover:border-[#aabfff] hover:bg-[#e0d8ff]"
                      : "border-[#e8e4dc] bg-white text-[#4648d4] hover:border-[#4648d4] hover:bg-[#ede9fe]")
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
                  "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-xs font-bold transition",
                  isLight
                    ? "border-[#e8e4dc] bg-white text-[#1a1a2e] hover:border-[#6b6660] hover:bg-[#faf8f5]"
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

      {activeImageUrl ? (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-all duration-300"
          onClick={() => setActiveImageUrl(null)}
        >
          <div className="absolute right-4 top-4 flex items-center gap-3">
            <a 
              href={activeImageUrl} 
              download 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition backdrop-blur border border-white/10"
            >
              <svg className="h-4 w-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </a>
            <button 
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition backdrop-blur border border-white/10 cursor-pointer"
              onClick={() => setActiveImageUrl(null)}
              type="button"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <img 
            src={activeImageUrl} 
            alt="Full view" 
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </Component>
  );
}
