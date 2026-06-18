import React from "react";
import CommunityAvatar from "./CommunityAvatar.jsx";
import { cx, formatCount, formatForumDate, getCommunityBadgeToneClasses, getSafeText } from "./communityUtils.js";

function MetricBlock({ label, value, variant }) {
  const isLight = variant === "light";

  return (
    <div className="flex items-center gap-2 whitespace-nowrap lg:justify-end">
      <span className={cx("text-[11px] font-bold uppercase tracking-[0.7px]", isLight ? "text-[#66758a]" : "text-[#75899d]")}>{label}</span>
      <strong className={cx("text-base font-black leading-none", isLight ? "text-[#172033]" : "text-[#f1f6fb]")}>{formatCount(value)}</strong>
    </div>
  );
}

export default function CommunityFeedRow({
  as: Component = "article",
  className = "",
  thread,
  LinkComponent = "a",
  variant = "dark",
  footerSlot = null,
  showExcerpt = true,
}) {
  const isLight = variant === "light";
  const safeThread = thread || {};
  const author = safeThread.author || {};
  const category = safeThread.category || {};
  const metrics = safeThread.metrics || {};
  const subjectList = Array.isArray(safeThread.subjects)
    ? safeThread.subjects.filter((subject) => getSafeText(subject?.code) || getSafeText(subject?.name))
    : [];
  const subject = safeThread.subject || subjectList[0] || {};
  const lastActivity = safeThread.lastActivity || {};
  const title = getSafeText(safeThread.title, "Untitled thread");
  const categoryLabel = getSafeText(category.label);
  const authorName = getSafeText(author.displayName) || getSafeText(author.email, "Anonymous user");
  const titleHref = getSafeText(safeThread.href);
  const titleProps = titleHref ? (typeof LinkComponent === "string" ? { href: titleHref } : { to: titleHref }) : {};
  const lastActivityHref = getSafeText(lastActivity.href);
  const LastActivityComponent = lastActivityHref ? LinkComponent : "div";
  const lastActivityProps = lastActivityHref ? (typeof LastActivityComponent === "string" ? { href: lastActivityHref } : { to: lastActivityHref }) : {};
  const lastActivityName = getSafeText(lastActivity.userName) || getSafeText(lastActivity.email, "No activity yet");
  const subtitleParts = [authorName, formatForumDate(safeThread.createdAt)].filter(Boolean);
  const visibleSubjectList = subjectList.length
    ? subjectList
    : (getSafeText(subject.code) || getSafeText(subject.name) ? [subject] : []);

  return (
    <Component
      className={cx(
        isLight
          ? "h-fit self-start overflow-hidden rounded-[24px] border border-[#dbe3ed] bg-white text-[#172033] shadow-[0_18px_40px_rgba(20,31,48,0.06)]"
          : "overflow-hidden border-b border-[#243142] bg-[#111924] text-[#dbe5f1] transition hover:bg-[#15212d]",
        className
      )}
    >
      <div className={cx("grid items-center gap-4 px-4 py-4 sm:px-5", isLight ? "lg:grid-cols-[52px_minmax(0,1fr)_132px_188px]" : "lg:grid-cols-[44px_minmax(0,1fr)_132px_196px] lg:items-center")}>
        <div className="flex items-center lg:justify-center">
          <CommunityAvatar
            avatarUrl={getSafeText(author.avatarUrl)}
            displayName={authorName}
            email={author.email}
            variant={variant}
            className={cx(
              "flex-none",
              isLight ? "h-12 w-12 border border-[#dbe3ed]" : "h-11 w-11 border border-[#314255]"
            )}
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {categoryLabel ? (
              <span
                className={cx(
                  "inline-flex min-h-7 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-[0.7px]",
                  getCommunityBadgeToneClasses(category.tone, "light")
                )}
              >
                {categoryLabel}
              </span>
            ) : null}

            {titleHref ? (
              <LinkComponent
                {...titleProps}
                className={cx(
                  "min-w-0 truncate text-[18px] font-black leading-tight no-underline transition",
                  isLight ? "text-[#2456d3] hover:text-[#173ea8] hover:underline" : "text-[#66a7ff] hover:text-[#91beff] hover:underline"
                )}
              >
                {title}
              </LinkComponent>
            ) : (
              <span className={cx("min-w-0 truncate text-[18px] font-black leading-tight", isLight ? "text-[#2456d3]" : "text-[#66a7ff]")}>{title}</span>
            )}
          </div>

          <div className={cx("mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm", isLight ? "text-[#66758a]" : "text-[#8fa0b2]")}>
            {subtitleParts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                {index ? <span className={isLight ? "text-[#b6c2d2]" : "text-[#5b6b7d]"}>|</span> : null}
                <span className="truncate">{part}</span>
              </React.Fragment>
            ))}
          </div>

          {visibleSubjectList.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleSubjectList.map((item) => (
                <span
                  className={cx(
                    "rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.5px]",
                    isLight ? "bg-[#f2f5f8] text-[#42526a]" : "bg-[#16212d] text-[#a8c7eb]"
                  )}
                  key={`${item.id || item.code}-${item.name || ""}`}
                >
                  {getSafeText(item.code) || getSafeText(item.name)}
                </span>
              ))}
            </div>
          ) : null}

          {showExcerpt && getSafeText(safeThread.excerpt) ? (
            <p className={cx("mt-2 truncate text-sm", isLight ? "text-[#526173]" : "text-[#70849a]")}>{safeThread.excerpt}</p>
          ) : null}

          {(safeThread.postType === "document_share" || safeThread.postType === "ai_study_log") && getSafeText(safeThread.attachmentSummary) ? (
            <p className={cx(
              "mt-1.5 flex items-center gap-1.5 truncate text-xs font-bold",
              isLight ? "text-[#4648d4]" : "text-[#6ea8ff]"
            )}>
              <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3Z"/>
              </svg>
              <span className="truncate">{safeThread.attachmentSummary}</span>
            </p>
          ) : null}
        </div>

        <div className={cx(
          "flex items-center gap-4 rounded-xl px-3 py-2 lg:flex-col lg:items-end lg:gap-1 lg:justify-self-end lg:p-0",
          isLight ? "border border-[#dbe3ed] bg-[#f7f9fb] lg:border-0 lg:bg-transparent" : "border border-[#223143] bg-[#0f1721] lg:border-0 lg:bg-transparent"
        )}>
          <MetricBlock label="Replies" value={metrics.replyCount} variant={variant} />
          <MetricBlock label="Views" value={metrics.viewCount} variant={variant} />
        </div>

        {getSafeText(lastActivity.at) || getSafeText(lastActivity.userName) || getSafeText(lastActivity.email) ? (
          <LastActivityComponent
            {...lastActivityProps}
            className={cx(
              "flex items-center justify-between gap-3 rounded-xl px-3 py-2 no-underline transition lg:justify-self-end lg:px-0 lg:py-0",
              isLight
                ? "border border-[#dbe3ed] bg-[#fbfcfe] hover:border-[#c7d2e2] hover:bg-white lg:border-0 lg:bg-transparent"
                : "border border-[#223143] bg-[#0f1721] hover:border-[#34506b] hover:bg-[#132030] lg:border-0 lg:bg-transparent",
              !lastActivityHref && "pointer-events-none"
            )}
          >
            <div className="min-w-0">
              <time className={cx("block truncate text-sm font-bold", isLight ? "text-[#4648d4]" : "text-[#6ea8ff]")}>{formatForumDate(lastActivity.at, { includeTime: true })}</time>
              <span className={cx("mt-1 block truncate text-sm", isLight ? "text-[#526173]" : "text-[#a6b7c9]")}>{lastActivityName}</span>
            </div>

            <CommunityAvatar
              avatarUrl={getSafeText(lastActivity.avatarUrl)}
              displayName={lastActivityName}
              email={lastActivity.email}
              variant={variant}
              className={cx("h-10 w-10 flex-none", isLight ? "border border-[#dbe3ed]" : "border border-[#314255]")}
            />
          </LastActivityComponent>
        ) : (
          <div className={cx(
            "rounded-xl border border-dashed px-3 py-2 text-sm lg:justify-self-end lg:border-0 lg:px-0 lg:py-0",
            isLight ? "border-[#dbe3ed] text-[#66758a]" : "border-[#2a394b] text-[#6f8194]"
          )}>
            No activity yet
          </div>
        )}
      </div>

      {footerSlot ? (
        <div className={cx(
          "flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-5",
          isLight ? "border-[#eef2f7] bg-[#fbfcfe]" : "border-[#243142] bg-[#111924]"
        )}>
          {footerSlot}
        </div>
      ) : null}
    </Component>
  );
}
