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

function getCategoryToneClasses(tone) {
  const normalizedTone = getSafeText(tone, "indigo").toLowerCase();

  const toneMap = {
    amber: "border-[#694b15] bg-[#3b2910] text-[#ffd981]",
    blue: "border-[#2b5d97] bg-[#14345c] text-[#90c9ff]",
    emerald: "border-[#286448] bg-[#123728] text-[#8de4bd]",
    indigo: "border-[#4766c7] bg-[#1e3264] text-[#c8d7ff]",
    rose: "border-[#94404d] bg-[#4a1d27] text-[#ffb4c1]",
    slate: "border-[#3a4a5f] bg-[#1a2634] text-[#d3dce7]",
  };

  return toneMap[normalizedTone] || toneMap.indigo;
}

function Avatar({ avatarUrl, displayName, email, className }) {
  const initials = getInitials(displayName, email);

  if (avatarUrl) {
    return <img className={cx("object-cover", className)} src={avatarUrl} alt={displayName || "User avatar"} loading="lazy" />;
  }

  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#3a566f,#1e2f43_60%,#132030)] font-black text-[#eff6ff]",
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div className="grid gap-0.5 text-left lg:text-right">
      <span className="text-[11px] font-bold uppercase tracking-[0.7px] text-[#75899d]">{label}</span>
      <strong className="text-lg font-black leading-none text-[#f1f6fb]">{formatCount(value)}</strong>
    </div>
  );
}

export default function CommunityFeedRow({
  as: Component = "article",
  className = "",
  thread,
  LinkComponent = "a",
}) {
  const safeThread = thread || {};
  const author = safeThread.author || {};
  const category = safeThread.category || {};
  const metrics = safeThread.metrics || {};
  const subject = safeThread.subject || {};
  const lastActivity = safeThread.lastActivity || {};
  const title = getSafeText(safeThread.title, "Untitled thread");
  const categoryLabel = getSafeText(category.label);
  const subjectCode = getSafeText(subject.code);
  const authorName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous user");
  const titleHref = getSafeText(safeThread.href);
  const titleProps = titleHref ? (typeof LinkComponent === "string" ? { href: titleHref } : { to: titleHref }) : {};
  const lastActivityHref = getSafeText(lastActivity.href);
  const LastActivityComponent = lastActivityHref ? LinkComponent : "div";
  const lastActivityProps = lastActivityHref ? (typeof LastActivityComponent === "string" ? { href: lastActivityHref } : { to: lastActivityHref }) : {};
  const lastActivityName = getSafeText(lastActivity.userName) || getSafeText(lastActivity.email, "No activity yet");
  const subtitleParts = [
    authorName,
    formatForumDate(safeThread.createdAt),
    subjectCode,
  ].filter(Boolean);

  return (
    <Component
      className={cx(
        "border-b border-[#243142] bg-[#111924] px-4 py-4 text-[#dbe5f1] transition hover:bg-[#15212d] sm:px-5",
        className
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[44px_minmax(0,1fr)_112px_196px] lg:items-center">
        <div className="flex items-start lg:items-center lg:justify-center">
          <Avatar
            avatarUrl={getSafeText(author.avatarUrl)}
            displayName={authorName}
            email={author.email}
            className="h-11 w-11 border border-[#314255]"
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {categoryLabel ? (
              <span
                className={cx(
                  "inline-flex min-h-7 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-[0.7px]",
                  getCategoryToneClasses(category.tone)
                )}
              >
                [{categoryLabel}]
              </span>
            ) : null}

            {titleHref ? (
              <LinkComponent
                {...titleProps}
                className="min-w-0 truncate text-[18px] font-black leading-tight text-[#66a7ff] no-underline transition hover:text-[#91beff]"
              >
                {title}
              </LinkComponent>
            ) : (
              <span className="min-w-0 truncate text-[18px] font-black leading-tight text-[#66a7ff]">{title}</span>
            )}
          </div>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#8fa0b2]">
            {subtitleParts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                {index ? <span className="text-[#5b6b7d]">•</span> : null}
                <span className="truncate">{part}</span>
              </React.Fragment>
            ))}
          </div>

          {getSafeText(safeThread.excerpt) ? <p className="mt-2 truncate text-sm text-[#70849a]">{safeThread.excerpt}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#223143] bg-[#0f1721] px-3 py-2 lg:grid-cols-1 lg:gap-2 lg:justify-self-end lg:border-0 lg:bg-transparent lg:p-0">
          <MetricBlock label="Replies" value={metrics.replyCount} />
          <MetricBlock label="Views" value={metrics.viewCount} />
        </div>

        {getSafeText(lastActivity.at) || getSafeText(lastActivity.userName) || getSafeText(lastActivity.email) ? (
          <LastActivityComponent
            {...lastActivityProps}
            className={cx(
              "flex items-center justify-between gap-3 rounded-xl border border-[#223143] bg-[#0f1721] px-3 py-2 no-underline transition hover:border-[#34506b] hover:bg-[#132030] lg:justify-self-end lg:border-0 lg:bg-transparent lg:px-0 lg:py-0",
              !lastActivityHref && "pointer-events-none"
            )}
          >
            <div className="min-w-0">
              <time className="block truncate text-sm font-bold text-[#6ea8ff]">{formatForumDate(lastActivity.at, { includeTime: true })}</time>
              <span className="mt-1 block truncate text-sm text-[#a6b7c9]">{lastActivityName}</span>
            </div>

            <Avatar
              avatarUrl={getSafeText(lastActivity.avatarUrl)}
              displayName={lastActivityName}
              email={lastActivity.email}
              className="h-10 w-10 flex-none border border-[#314255]"
            />
          </LastActivityComponent>
        ) : (
          <div className="rounded-xl border border-dashed border-[#2a394b] px-3 py-2 text-sm text-[#6f8194] lg:justify-self-end lg:border-0 lg:px-0 lg:py-0">
            No activity yet
          </div>
        )}
      </div>
    </Component>
  );
}
