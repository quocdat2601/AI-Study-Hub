import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadCommunityImage } from "../../services/communityApi.js";
import {
  CREATE_POST_RULES,
  getComposerContent,
  getPostTypeLabel,
  getSelectedSubjects,
  MAX_POST_SUBJECTS,
  mergeSubjectIds,
} from "./communityComposerUtils.js";

function AttachmentIcon() {
  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 6.5 9 14a3 3 0 1 0 4.2 4.2l7.3-7.3a5 5 0 1 0-7.1-7.1L5.7 11.5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="m-0 text-xs font-bold text-[#ffb4b4]">{message}</p>;
}

function SubjectMultiSelect({
  subjects,
  selectedIds,
  onChange,
  disabled,
  error,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedSubjects = useMemo(() => getSelectedSubjects(subjects, selectedIds), [selectedIds, subjects]);
  const selectedIdSet = useMemo(() => new Set((selectedIds || []).map(String)), [selectedIds]);
  const availableSubjects = useMemo(() => {
    const searchLower = query.trim().toLowerCase();
    return subjects
      .filter((subject) => !selectedIdSet.has(String(subject.id)))
      .filter((subject) => {
        if (!searchLower) return true;
        const haystack = `${subject.code} ${subject.name}`.toLowerCase();
        return haystack.includes(searchLower);
      })
      .slice(0, 8);
  }, [query, selectedIdSet, subjects]);

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

  function addSubject(subjectId) {
    onChange(mergeSubjectIds(selectedIds, [subjectId]));
    setQuery("");
    setIsOpen(true);
    inputRef.current?.focus();
  }

  function removeSubject(subjectId) {
    onChange((selectedIds || []).filter((value) => String(value) !== String(subjectId)));
    inputRef.current?.focus();
  }

  const hasReachedLimit = (selectedIds || []).length >= MAX_POST_SUBJECTS;
  const showDropdown = isOpen && !disabled && (!hasReachedLimit || availableSubjects.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`rounded-2xl border bg-white px-4 py-3 text-[#172033] transition ${error ? "border-[#ff8c8c]" : "border-[#43526a]"} ${isOpen ? "shadow-[0_0_0_4px_rgba(255,255,255,0.08)]" : ""}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
      >
        <div className="flex flex-wrap items-center gap-2">
          {selectedSubjects.map((subject) => (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-[#172033] px-3 py-1.5 text-xs font-extrabold text-white"
              key={subject.id}
            >
              <span>{subject.code}</span>
              <button
                aria-label={`Remove ${subject.code}`}
                className="inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-transparent p-0 text-[10px] leading-none text-white transition hover:bg-white/15"
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeSubject(subject.id);
                }}
                type="button"
              >
                <span aria-hidden="true">x</span>
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            className="min-w-[180px] flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[#172033] outline-none placeholder:text-[#7a8798]"
            disabled={disabled || hasReachedLimit}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
            placeholder={selectedSubjects.length
              ? (hasReachedLimit ? `Maximum ${MAX_POST_SUBJECTS} subjects selected.` : "Add another subject")
              : (hasReachedLimit ? `Maximum ${MAX_POST_SUBJECTS} subjects selected.` : "Search subject code or name")}
            value={query}
          />
        </div>
      </div>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-[#334154] bg-[#101722] shadow-[0_24px_45px_rgba(8,13,22,0.45)]">
          {availableSubjects.length ? (
            <div className="max-h-56 overflow-y-auto py-2">
              {availableSubjects.map((subject) => (
                <button
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-[rgba(255,255,255,0.08)]"
                  disabled={disabled || hasReachedLimit}
                  key={subject.id}
                  onClick={() => addSubject(subject.id)}
                  type="button"
                >
                  <span className="truncate">{subject.code}</span>
                  <span className="truncate text-right text-xs font-medium text-[#9fb0c3]">{subject.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-[#9fb0c3]">
              {hasReachedLimit ? `Maximum ${MAX_POST_SUBJECTS} subjects selected.` : "No matching subjects."}
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2">
          <FieldError message={error} />
        </div>
      ) : null}
    </div>
  );
}

function PickerCard({ icon, title, subtitle, actionLabel, selectedLabel, isOpen, onToggle, children }) {
  return (
    <div className="rounded-[22px] border border-[#43526a] bg-[rgba(255,255,255,0.08)] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.12)] text-white">
            {icon}
          </span>
          <div>
            <strong className="block text-sm uppercase tracking-[0.08em] text-white">{title}</strong>
            <p className="mt-1 mb-0 text-sm leading-6 text-[#d5deea]">{selectedLabel || subtitle}</p>
          </div>
        </div>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#172033]" onClick={onToggle} type="button">
          {actionLabel}
        </button>
      </div>
      {isOpen ? <div className="mt-4 grid gap-2">{children}</div> : null}
    </div>
  );
}

export default function CommunityComposer({
  isAuthenticated,
  subjects,
  documents,
  sessions,
  draft,
  setDraft,
  onSubmit,
  isSubmitting,
  submitError,
  validationErrors,
  onRequireAuth,
  showPreview = false,
}) {
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const bodyRef = useRef(null);
  const imageInputRef = useRef(null);

  const wrapSelection = useCallback((before, after) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const replacement = `${before}${selected || "text"}${after}`;
    const next = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
    updateField("body", next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected || "text").length);
    });
  }, []);

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setImageUploadError("");
    setIsUploadingImage(true);
    try {
      const result = await uploadCommunityImage(file);
      const textarea = bodyRef.current;
      const cursorPos = textarea ? textarea.selectionStart : (draft.body?.length ?? 0);
      const insert = `\n![](${result.url})\n`;
      const next = (draft.body || "").slice(0, cursorPos) + insert + (draft.body || "").slice(cursorPos);
      updateField("body", next);
    } catch (err) {
      setImageUploadError(err.response?.data?.error || "Image upload failed. Try again.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  const readyDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "indexed" && doc.extraction_status === "ready"),
    [documents]
  );

  const selectedDocument = readyDocuments.find((doc) => String(doc.id) === String(draft.documentId));
  const selectedSession = sessions.find((item) => String(item.session.id) === String(draft.chatSessionId));
  const composerContent = getComposerContent(draft.postType);
  const selectedSubjects = useMemo(
    () => getSelectedSubjects(subjects, draft.subjectIds),
    [draft.subjectIds, subjects]
  );
  const publishBadges = [
    selectedSubjects.length ? `${selectedSubjects.length} subject${selectedSubjects.length === 1 ? "" : "s"}` : "No subjects",
    getPostTypeLabel(draft.postType),
  ];

  function updateField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const postTypeButtons = [
    { value: "discussion", label: "Discussion" },
    { value: "question", label: "Question" },
    { value: "document_share", label: "Document" },
    { value: "ai_study_log", label: "AI Study Log" },
  ];

  function updatePostType(nextType) {
    setDraft((current) => ({
      ...current,
      postType: nextType,
      documentId: nextType === "document_share" ? current.documentId : "",
      chatSessionId: nextType === "ai_study_log" ? current.chatSessionId : "",
    }));
    setIsDocumentPickerOpen(nextType === "document_share");
    setIsSessionPickerOpen(nextType === "ai_study_log");
  }

  return (
    <div className="rounded-[24px] border border-[#c7c4d7] bg-[#172033] p-5 text-white shadow-[0_24px_45px_rgba(20,31,48,0.18)]">
      <div className="relative">
        {!isAuthenticated ? (
          <button
            aria-label="Log in to create a community post"
            className="absolute inset-0 z-10 cursor-pointer rounded-[24px] bg-transparent"
            onClick={onRequireAuth}
            type="button"
          />
        ) : null}

        <form className="grid gap-4" onSubmit={onSubmit}>
          {!isAuthenticated ? (
            <div className="rounded-[24px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-4 py-4 text-sm text-[#dce5f0]">
              Browse the composer first, then sign in when you are ready to publish.
            </div>
          ) : null}

          <div className="grid gap-3 rounded-[22px] border border-[#334154] bg-[rgba(11,18,29,0.38)] p-4 md:p-5">
            <div className="flex flex-wrap gap-2">
              {postTypeButtons.map((option) => (
                <button
                  key={option.value}
                  className={draft.postType === option.value
                    ? "rounded-full border border-white bg-white px-4 py-2 text-sm font-extrabold text-[#172033]"
                    : "rounded-full border border-[rgba(255,255,255,0.16)] bg-transparent px-4 py-2 text-sm font-bold text-[#d5deea]"}
                  disabled={!isAuthenticated}
                  onClick={() => updatePostType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="grid gap-2 text-sm font-bold">
              <div className="flex items-center justify-between gap-3">
                <span>Subjects (optional)</span>
                <span className="text-xs font-black text-[#9fb0c3]">{selectedSubjects.length}/{MAX_POST_SUBJECTS}</span>
              </div>
              <SubjectMultiSelect
                disabled={!isAuthenticated}
                error={validationErrors.subjectIds}
                onChange={(nextSubjectIds) => updateField("subjectIds", nextSubjectIds)}
                selectedIds={draft.subjectIds}
                subjects={subjects}
              />
              <p className="m-0 text-xs leading-5 text-[#9fb0c3]">Attach up to {MAX_POST_SUBJECTS} subjects if they help classmates discover this post.</p>
            </label>

            <label className="grid gap-2 text-sm font-bold">
              <div className="flex items-center justify-between gap-3">
                <span>Title</span>
                <span className="text-xs font-black text-[#9fb0c3]">{draft.title.trim().length}/{CREATE_POST_RULES.titleMax}</span>
              </div>
              <input
                className={`rounded-2xl border bg-white px-4 py-3 text-[#172033] ${validationErrors.title ? "border-[#ff8c8c]" : "border-[#43526a]"}`}
                disabled={!isAuthenticated}
                maxLength={CREATE_POST_RULES.titleMax}
                placeholder={composerContent.titlePlaceholder}
                value={draft.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
              <p className="m-0 text-xs text-[#9fb0c3]">Minimum {CREATE_POST_RULES.titleMin} characters.</p>
              <FieldError message={validationErrors.title} />
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm font-bold">
                <span className="text-white">Body</span>
                <span className="text-xs font-black text-[#9fb0c3]">{draft.body.trim().length}/{CREATE_POST_RULES.bodyMax}</span>
              </div>

              <div className="flex items-center gap-1 rounded-t-2xl border border-b-0 border-[#43526a] bg-[rgba(255,255,255,0.05)] px-3 py-1.5">
                <button
                  aria-label="Bold (Ctrl+B)"
                  className="rounded px-2 py-1 text-sm font-black text-white transition hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-40"
                  disabled={!isAuthenticated}
                  onClick={() => wrapSelection("**", "**")}
                  title="Bold (Ctrl+B)"
                  type="button"
                >
                  B
                </button>
                <button
                  aria-label="Italic (Ctrl+I)"
                  className="rounded px-2 py-1 text-sm font-bold italic text-white transition hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-40"
                  disabled={!isAuthenticated}
                  onClick={() => wrapSelection("*", "*")}
                  title="Italic (Ctrl+I)"
                  type="button"
                >
                  I
                </button>
                <div className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.18)]" aria-hidden="true" />
                <button
                  aria-label="Insert image"
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold text-white transition hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-40"
                  disabled={!isAuthenticated || isUploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                  title="Insert image"
                  type="button"
                >
                  {isUploadingImage ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" strokeLinecap="round" opacity="0.3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-.138-.138a.75.75 0 0 0-1.06 0L6.17 11.086l-3.67-3.67v3.654Zm2.5-7.56a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isUploadingImage ? "Uploading…" : "Photo"}
                </button>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-hidden="true"
                  className="hidden"
                  disabled={!isAuthenticated || isUploadingImage}
                  onChange={handleImageUpload}
                  ref={imageInputRef}
                  type="file"
                />
              </div>

              <textarea
                ref={bodyRef}
                className={`-mt-px min-h-[180px] rounded-b-2xl rounded-t-none border bg-white px-4 py-3 text-[#172033] ${validationErrors.body ? "border-[#ff8c8c]" : "border-[#43526a]"}`}
                disabled={!isAuthenticated}
                maxLength={CREATE_POST_RULES.bodyMax}
                placeholder={composerContent.bodyPlaceholder}
                value={draft.body}
                onChange={(event) => updateField("body", event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "b") {
                    event.preventDefault();
                    wrapSelection("**", "**");
                  }
                  if ((event.ctrlKey || event.metaKey) && event.key === "i") {
                    event.preventDefault();
                    wrapSelection("*", "*");
                  }
                }}
              />
              {imageUploadError ? <p className="m-0 text-xs font-bold text-[#ffb4b4]">{imageUploadError}</p> : null}
              <p className="m-0 text-xs leading-5 text-[#9fb0c3]">{composerContent.bodyHint} Supports **bold**, *italic*, and inline images.</p>
              <FieldError message={validationErrors.body} />
            </div>

            {draft.postType === "document_share" ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm font-extrabold text-white">Attached document</p>
                <PickerCard
                  actionLabel={isDocumentPickerOpen ? "Hide Library Files" : "Select Indexed Document"}
                  icon={<AttachmentIcon />}
                  isOpen={isDocumentPickerOpen}
                  onToggle={() => setIsDocumentPickerOpen((current) => !current)}
                  selectedLabel={selectedDocument ? selectedDocument.title : ""}
                  subtitle="Choose one indexed document that is ready to share."
                  title="Document"
                >
                  {readyDocuments.length ? readyDocuments.map((doc) => (
                    <button
                      className={String(draft.documentId) === String(doc.id)
                        ? "rounded-2xl border border-white bg-white px-4 py-3 text-left text-sm font-extrabold text-[#172033]"
                        : "rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-sm font-bold text-white"}
                      key={doc.id}
                      onClick={() => updateField("documentId", String(doc.id))}
                      type="button"
                    >
                      <span className="block">{doc.title}</span>
                      <span className="mt-1 block text-xs text-[#99a6ba]">{doc.subjects?.code || "No subject"} - Ready for sharing</span>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.16)] px-4 py-4 text-sm text-[#d5deea]">
                      {composerContent.attachmentEmpty}
                    </div>
                  )}
                </PickerCard>
                <FieldError message={validationErrors.documentId} />
              </div>
            ) : null}

            {draft.postType === "ai_study_log" ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm font-extrabold text-white">Attached AI session</p>
                <PickerCard
                  actionLabel={isSessionPickerOpen ? "Hide AI Sessions" : "Attach Conversation"}
                  icon={<SparkIcon />}
                  isOpen={isSessionPickerOpen}
                  onToggle={() => setIsSessionPickerOpen((current) => !current)}
                  selectedLabel={selectedSession ? selectedSession.session.title : ""}
                  subtitle="Choose one AI study session to publish."
                  title="AI Study Log"
                >
                  {sessions.length ? sessions.map((item) => (
                    <button
                      className={String(draft.chatSessionId) === String(item.session.id)
                        ? "rounded-2xl border border-white bg-white px-4 py-3 text-left text-sm font-extrabold text-[#172033]"
                        : "rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-sm font-bold text-white"}
                      key={item.session.id}
                      onClick={() => updateField("chatSessionId", String(item.session.id))}
                      type="button"
                    >
                      <span className="block">{item.session.title}</span>
                      <span className="mt-1 block text-xs text-[#99a6ba]">{item.documents.length} linked documents</span>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.16)] px-4 py-4 text-sm text-[#d5deea]">
                      {composerContent.attachmentEmpty}
                    </div>
                  )}
                </PickerCard>
                <FieldError message={validationErrors.chatSessionId} />
              </div>
            ) : null}

            {showPreview && isPreviewOpen ? (
              <div className="rounded-[18px] border border-[#324255] bg-[#101722] p-4">
                <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#99a6ba]">Publish preview</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {publishBadges.map((badge) => (
                    <span className="rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs font-extrabold text-white" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-2xl border border-[#ff8c8c] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm font-bold text-[#ffd7d7]">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#9fb0c3]">Subjects are optional. Attachments only appear for document and AI study log posts.</div>
              <div className="flex items-center gap-3">
                {showPreview ? (
                  <button
                    className="rounded-full border border-[rgba(255,255,255,0.16)] px-4 py-2 text-sm font-bold text-white"
                    onClick={() => setIsPreviewOpen((current) => !current)}
                    type="button"
                  >
                    {isPreviewOpen ? "Hide Preview" : "Preview"}
                  </button>
                ) : null}
                <button
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-[#172033] disabled:cursor-not-allowed disabled:bg-[#cbd5e1] disabled:text-[#5f7084]"
                  disabled={!isAuthenticated || isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Publishing..." : "Publish to Community"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
