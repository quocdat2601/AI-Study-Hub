import React from "react";
import {
  cx,
  formatBytes,
  formatForumDate,
  getSafeText,
  pickArray,
  pickObject,
} from "./communityUtils.js";

function DocumentSharePreview({ payload, isAuthenticated, onOpenDocument, variant }) {
  const title = getSafeText(payload.title || payload.fileName || payload.document_title || payload.name, "Shared document");
  const sizeBytes = payload.fileSizeBytes || payload.size_bytes || payload.sizeBytes || payload.file_size_bytes || payload.byte_size;
  const resourceUrl = getSafeText(payload.viewUrl || payload.view_url || payload.downloadUrl || payload.download_url || payload.url);
  const canOpenProtectedDocument = isAuthenticated && (resourceUrl || payload.id);
  const isLight = variant === "light";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={cx("m-0 text-xs font-black uppercase tracking-[0.8px]", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>Document share</p>
        <h2 className={cx("mt-2 text-lg font-black", isLight ? "text-[#172033]" : "text-[#f5f8fc]")}>{title}</h2>
        <div className={cx("mt-2 flex flex-wrap items-center gap-2 text-sm", isLight ? "text-[#66758a]" : "text-[#a6b7c9]")}>
          <span className={cx(
            "rounded-full border px-3 py-1 font-bold",
            isLight ? "border-[#dbe3ed] bg-white" : "border-[#31445a] bg-[#16212d]"
          )}>
            Size: {formatBytes(sizeBytes)}
          </span>
          <span className={cx(
            "rounded-full border px-3 py-1 font-bold",
            isLight ? "border-[#dbe3ed] bg-white" : "border-[#31445a] bg-[#16212d]"
          )}>
            Protected preview
          </span>
        </div>
      </div>

      {canOpenProtectedDocument ? (
        resourceUrl ? (
          <a
            className={cx(
              "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black no-underline transition",
              isLight
                ? "border border-[#4648d4] bg-[#4648d4] text-white hover:bg-[#3537b8]"
                : "border border-[#4c78a8] bg-[#17304b] text-[#eff6ff] hover:bg-[#214060]"
            )}
            href={resourceUrl}
          >
            Open document
          </a>
        ) : (
          <button
            className={cx(
              "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black transition",
              isLight
                ? "border border-[#4648d4] bg-[#4648d4] text-white hover:bg-[#3537b8]"
                : "border border-[#4c78a8] bg-[#17304b] text-[#eff6ff] hover:bg-[#214060]"
            )}
            type="button"
            onClick={onOpenDocument}
          >
            Open document
          </button>
        )
      ) : (
        <div className={cx(
          "inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed px-4 text-sm font-bold",
          isLight ? "border-[#c7d2e2] text-[#66758a]" : "border-[#31445a] text-[#a6b7c9]"
        )}>
          {isAuthenticated ? "Document is not ready yet" : "Log in to open or download this document"}
        </div>
      )}
    </div>
  );
}

function StudyLogPreview({ payload, variant }) {
  const session = pickObject(payload.session);
  const messages = pickArray(payload.messages, payload.chat_messages, payload.entries, payload.log);
  const isLight = variant === "light";

  if (!messages.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className={cx("m-0 text-xs font-black uppercase tracking-[0.8px]", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>AI study log</p>
        <h2 className={cx("mt-2 text-lg font-black", isLight ? "text-[#172033]" : "text-[#f5f8fc]")}>
          {getSafeText(session.title, "Attached study conversation")}
        </h2>
      </div>

      <div className="grid gap-3">
        {messages.map((message, index) => {
          const role = getSafeText(message.role, "assistant").toLowerCase();
          const content = getSafeText(message.content || message.text || message.message, "No message content.");
          const createdAt = message.createdAt || message.created_at || message.timestamp || null;
          const toneClass = role === "user"
            ? (isLight ? "border-[#cfe0ff] bg-[#eef4ff] text-[#172033]" : "border-[#315175] bg-[#13273b] text-[#eff6ff]")
            : (isLight ? "border-[#dbe3ed] bg-white text-[#344154]" : "border-[#31445a] bg-[#16212d] text-[#d1dae5]");

          return (
            <article className={cx("rounded-xl border p-3", toneClass)} key={`${role}-${index}`}>
              <header className="flex items-center justify-between gap-3">
                <strong className="text-sm font-black uppercase tracking-[0.6px]">
                  {role === "user" ? "You" : role === "assistant" ? "AI" : role}
                </strong>
                {createdAt ? (
                  <time className={cx("text-xs font-bold", isLight ? "text-[#66758a]" : "text-[#95a6b8]")}>
                    {formatForumDate(createdAt, { includeTime: true })}
                  </time>
                ) : null}
              </header>
              <p className="m-0 mt-2 whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function CommunityAttachmentPreview({
  post,
  isAuthenticated = false,
  onOpenDocument,
  variant = "light",
}) {
  if (!post) return null;

  if (post.postType === "document_share") {
    return (
      <DocumentSharePreview
        payload={post.attachmentPayload || {}}
        isAuthenticated={isAuthenticated}
        onOpenDocument={onOpenDocument}
        variant={variant}
      />
    );
  }

  if (post.postType === "ai_study_log") {
    return <StudyLogPreview payload={post.attachmentPayload || {}} variant={variant} />;
  }

  return null;
}
