import React from "react";

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

function getSafeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(getSafeNumber(value));
}

function formatForumDate(value, { includeTime = false } = {}) {
  if (!value) return "Unknown";

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  if (!includeTime) {
    return dateFormatter.format(parsedDate);
  }

  const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateFormatter.format(parsedDate)} ${timeFormatter.format(parsedDate)}`;
}

function getInitials(displayName, email) {
  const source = getSafeText(displayName) || getSafeText(email) || "User";
  const sanitized = source.includes("@") ? source.split("@")[0] : source;
  const parts = sanitized
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

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

function Avatar({ avatarUrl, displayName, email, className }) {
  const initials = getInitials(displayName, email);

  if (avatarUrl) {
    return <img className={cx("object-cover", className)} src={avatarUrl} alt={displayName || "User avatar"} loading="lazy" />;
  }

  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#355173,#182433_62%,#101721)] font-black text-[#f7fbff]",
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
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

  return (
    <Component
      className={cx(
        "overflow-hidden rounded-2xl border border-[#243142] bg-[#121a24] text-[#dbe5f1] shadow-[0_18px_48px_rgba(4,10,18,0.22)]",
        className
      )}
    >
      <div className="flex flex-col md:flex-row">
        <aside className="border-b border-[#243142] bg-[#0f1721] px-4 py-5 md:w-40 md:flex-none md:border-b-0 md:border-r md:px-3">
          <div className="flex items-start gap-4 md:flex-col md:items-center md:text-center">
            <Avatar
              avatarUrl={getSafeText(author.avatarUrl)}
              displayName={displayName}
              email={author.email}
              className="h-16 w-16 flex-none rounded-full border border-[#2d3d51] md:h-[84px] md:w-[84px]"
            />

            <div className="min-w-0 flex-1 md:w-full">
              <ProfileComponent
                {...profileProps}
                className={cx(
                  "block truncate text-base font-extrabold text-[#f4f8fc] no-underline transition hover:text-[#89bfff]",
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

          <dl className="mt-5 grid gap-2 border-t border-[#202c3b] pt-4 text-[13px] leading-5 text-[#95a6b8]">
            <div className="flex items-center justify-between gap-3">
              <dt>Join date</dt>
              <dd className="m-0 font-bold text-[#edf4fb]">{formatForumDate(author.joinedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Post totals</dt>
              <dd className="m-0 font-bold text-[#edf4fb]">{formatCount(author.postCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Utility points</dt>
              <dd className="m-0 font-bold text-[#edf4fb]">{formatCount(author.utilityPoints)}</dd>
            </div>
          </dl>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243142] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2 text-sm text-[#94a5b8]">
              <span className="font-medium text-[#a9bfd5]">Created</span>
              <time className="truncate font-semibold text-[#dbe7f5]">{formatForumDate(safePost.createdAt, { includeTime: true })}</time>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2a394b] bg-[#16202c] text-[#a6bad0] transition hover:border-[#3d5570] hover:text-[#f4f8fc]"
                type="button"
                onClick={(event) => onShare?.(safePost, event)}
                aria-label={`Share post ${itemIndex}`}
              >
                <ShareIcon />
              </button>
              <span className="inline-flex min-h-9 items-center rounded-full border border-[#31445a] bg-[#172231] px-3 text-sm font-black text-[#dbe7f5]">
                {itemIndex}
              </span>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-5">
            {title ? <h1 className="m-0 text-[28px] font-black leading-[1.2] text-[#f5f8fc]">{title}</h1> : null}
            <div className={cx("text-[15px] leading-7 text-[#d1dae5]", title && "mt-4")}>
              <p className="m-0 whitespace-pre-wrap break-words">{content}</p>
            </div>

            {attachmentSlot ? (
              <section className="mt-5 rounded-xl border border-[#26384b] bg-[#101722] p-4">
                <p className="m-0 mb-3 text-xs font-black uppercase tracking-[0.8px] text-[#7f96ad]">Attachments</p>
                <div>{attachmentSlot}</div>
              </section>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#243142] bg-[#111924] px-4 py-3 sm:px-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2c3a4c] bg-[#16212d] px-3 py-2 text-sm font-bold text-[#dbe7f5]">
              <UpvoteIcon />
              <span>{formatCount(metrics.upvoteCount)} upvotes</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#2f4f78] bg-[#12243a] px-4 text-sm font-black text-[#8dc6ff] transition hover:border-[#4c78a8] hover:bg-[#17304b]"
                type="button"
                onClick={(event) => onUpvote?.(safePost, event)}
              >
                <UpvoteIcon />
                <span>Upvote</span>
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#31445a] bg-[#16212d] px-4 text-sm font-black text-[#dbe7f5] transition hover:border-[#4a627d] hover:bg-[#1a2836]"
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
