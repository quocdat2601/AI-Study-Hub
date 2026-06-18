import React from "react";
import {
  cx,
  formatBytes,
  formatForumDate,
  getSafeText,
  pickArray,
  pickObject,
} from "./communityUtils.js";

function FileTypeIcon({ fileType }) {
  const type = getSafeText(fileType).toUpperCase();
  const colorMap = {
    PDF: "bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]",
    DOCX: "bg-[#dbeafe] text-[#1d4ed8] border-[#93c5fd]",
    DOC: "bg-[#dbeafe] text-[#1d4ed8] border-[#93c5fd]",
    PNG: "bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]",
    JPG: "bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]",
  };
  const cls = colorMap[type] || "bg-[#f3f4f6] text-[#374151] border-[#d1d5db]";
  return (
    <span className={cx("inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.8px]", cls)}>
      {type || "FILE"}
    </span>
  );
}

function DocumentSharePreview({ payload, isAuthenticated, onOpenDocument, variant }) {
  const title = getSafeText(payload.title || payload.fileName || payload.document_title || payload.name, "Shared document");
  const sizeBytes = payload.fileSizeBytes || payload.size_bytes || payload.sizeBytes || payload.file_size_bytes || payload.byte_size;
  const fileType = getSafeText(payload.fileType || payload.file_type || payload.type);
  const thumbnailUrl = getSafeText(payload.thumbnailUrl || payload.thumbnail_url || payload.thumb);
  const abstract = getSafeText(payload.previewText || payload.abstractPreview || payload.abstract_preview || payload.preview_text || payload.abstract);
  const subject = getSafeText(payload.subjectCode || payload.subject_code || payload.subject?.code);
  const resourceUrl = getSafeText(payload.viewUrl || payload.view_url || payload.downloadUrl || payload.download_url || payload.url);
  const canOpenProtectedDocument = isAuthenticated && (resourceUrl || payload.id);
  const isLight = variant === "light";

  return (
    <div className={cx(
      "overflow-hidden rounded-2xl border",
      isLight ? "border-[#dbe3ed] bg-[#f7f9fb]" : "border-[#2a3d52] bg-[#111c28]"
    )}>
      <div className="flex gap-0">
        {thumbnailUrl ? (
          <div className="hidden w-[120px] flex-none sm:block">
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
              style={{ minHeight: "140px", maxHeight: "200px" }}
            />
          </div>
        ) : (
          <div className={cx(
            "hidden w-[96px] flex-none items-center justify-center sm:flex",
            isLight ? "bg-[#eef2f7]" : "bg-[#172033]"
          )}>
            <svg className={cx("h-10 w-10", isLight ? "text-[#8fa3bd]" : "text-[#4a6278]")} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
        )}

        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cx("m-0 text-xs font-black uppercase tracking-[0.8px]", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>Document share</p>
            {fileType ? <FileTypeIcon fileType={fileType} /> : null}
            {subject ? (
              <span className={cx(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                isLight ? "border-[#dbe3ed] bg-white text-[#42526a]" : "border-[#31445a] bg-[#16212d] text-[#a8c7eb]"
              )}>{subject}</span>
            ) : null}
          </div>

          <h2 className={cx("mt-2 text-base font-black leading-snug", isLight ? "text-[#172033]" : "text-[#f5f8fc]")}>{title}</h2>

          {abstract ? (
            <p className={cx("mt-2 line-clamp-3 text-sm leading-6", isLight ? "text-[#526173]" : "text-[#a6b7c9]")}>{abstract}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {sizeBytes ? (
              <span className={cx("text-xs font-bold", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>
                {formatBytes(sizeBytes)}
              </span>
            ) : null}

            {canOpenProtectedDocument ? (
              resourceUrl ? (
                <a
                  className={cx(
                    "inline-flex min-h-9 items-center gap-2 rounded-xl px-4 text-sm font-black no-underline transition",
                    isLight
                      ? "border border-[#4648d4] bg-[#4648d4] text-white hover:bg-[#3537b8]"
                      : "border border-[#4c78a8] bg-[#17304b] text-[#eff6ff] hover:bg-[#214060]"
                  )}
                  href={resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </svg>
                  Open document
                </a>
              ) : (
                <button
                  className={cx(
                    "inline-flex min-h-9 items-center gap-2 rounded-xl px-4 text-sm font-black transition",
                    isLight
                      ? "border border-[#4648d4] bg-[#4648d4] text-white hover:bg-[#3537b8]"
                      : "border border-[#4c78a8] bg-[#17304b] text-[#eff6ff] hover:bg-[#214060]"
                  )}
                  type="button"
                  onClick={onOpenDocument}
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </svg>
                  Open document
                </button>
              )
            ) : (
              <span className={cx(
                "inline-flex min-h-9 items-center rounded-xl border border-dashed px-4 text-sm font-bold",
                isLight ? "border-[#c7d2e2] text-[#66758a]" : "border-[#31445a] text-[#a6b7c9]"
              )}>
                {isAuthenticated ? "Document is not ready yet" : "Log in to open this document"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudyLogPreview({ payload, variant }) {
  const session = pickObject(payload.session);
  const messages = pickArray(payload.messages, payload.chat_messages, payload.entries, payload.log);
  const documents = pickArray(payload.documents);
  const isLight = variant === "light";

  if (!messages.length && !session.title) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className={cx(
        "overflow-hidden rounded-2xl border",
        isLight ? "border-[#dbe3ed] bg-[#f7f9fb]" : "border-[#2a3d52] bg-[#111c28]"
      )}>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className={cx(
              "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.8px]",
              isLight ? "border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]" : "border-[#523884] bg-[#281a45] text-[#c7a6ff]"
            )}>AI Study Log</span>
            {session.lastActivityAt ? (
              <time className={cx("text-xs font-bold", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>
                {formatForumDate(session.lastActivityAt, { includeTime: true })}
              </time>
            ) : null}
          </div>
          <h2 className={cx("mt-2 text-base font-black leading-snug", isLight ? "text-[#172033]" : "text-[#f5f8fc]")}>
            {getSafeText(session.title, "Attached study conversation")}
          </h2>
          {documents.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {documents.slice(0, 4).map((doc, i) => (
                <span
                  key={doc.id || i}
                  className={cx(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                    isLight ? "border-[#dbe3ed] bg-white text-[#42526a]" : "border-[#31445a] bg-[#16212d] text-[#a8c7eb]"
                  )}
                >
                  {getSafeText(doc.title, "Document")}
                </span>
              ))}
              {documents.length > 4 ? (
                <span className={cx("text-xs font-bold", isLight ? "text-[#66758a]" : "text-[#7f96ad]")}>+{documents.length - 4} more</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {messages.length ? (
          <div className={cx("border-t", isLight ? "border-[#dbe3ed]" : "border-[#2a3d52]")}>
            <div className="grid gap-0 divide-y" style={{ maxHeight: "360px", overflowY: "auto" }}>
              {messages.map((message, index) => {
                const role = getSafeText(message.role, "assistant").toLowerCase();
                const content = getSafeText(message.content || message.text || message.message, "No message content.");
                const isUser = role === "user";
                const toneClass = isUser
                  ? (isLight ? "bg-[#eef4ff] text-[#172033]" : "bg-[#13273b] text-[#eff6ff]")
                  : (isLight ? "bg-white text-[#344154]" : "bg-[#16212d] text-[#d1dae5]");

                return (
                  <div className={cx("px-4 py-3", toneClass)} key={`${role}-${index}`}>
                    <strong className={cx(
                      "block text-[11px] font-black uppercase tracking-[0.6px] mb-1",
                      isUser
                        ? (isLight ? "text-[#4648d4]" : "text-[#87c4ff]")
                        : (isLight ? "text-[#66758a]" : "text-[#7f96ad]")
                    )}>
                      {isUser ? "You" : role === "assistant" ? "AI" : role}
                    </strong>
                    <p className="m-0 whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
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
        payload={post.attachmentPayload || post.documentAttachment || {}}
        isAuthenticated={isAuthenticated}
        onOpenDocument={onOpenDocument}
        variant={variant}
      />
    );
  }

  if (post.postType === "ai_study_log") {
    return <StudyLogPreview payload={post.attachmentPayload || post.chatAttachment || {}} variant={variant} />;
  }

  return null;
}


