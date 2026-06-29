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
        className={`rounded-xl border bg-white px-4 py-2.5 text-[#1a1a2e] transition ${error ? "border-[#ff8c8c]" : "border-[#e4e0d8]"} ${isOpen ? "shadow-[0_0_0_3px_rgba(70,72,212,0.12)] border-[#4648d4]" : ""}`}
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
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ede9fe] px-2.5 py-1 text-xs font-bold text-[#4648d4]"
              key={subject.id}
            >
              <span>{subject.code}</span>
              <button
                aria-label={`Remove ${subject.code}`}
                className="inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-transparent p-0 text-[10px] leading-none text-[#4648d4] transition hover:bg-[#4648d4]/10"
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
            className="min-w-[180px] flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[#1a1a2e] outline-none placeholder:text-[#8c857e]"
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
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-[#e8e4dc] bg-white shadow-md">
          {availableSubjects.length ? (
            <div className="max-h-56 overflow-y-auto py-1">
              {availableSubjects.map((subject) => (
                <button
                  className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm font-bold text-[#1a1a2e] transition hover:bg-[#faf8f5]"
                  disabled={disabled || hasReachedLimit}
                  key={subject.id}
                  onClick={() => addSubject(subject.id)}
                  type="button"
                >
                  <span className="truncate">{subject.code}</span>
                  <span className="truncate text-right text-xs font-medium text-[#8c857e]">{subject.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-2.5 text-sm text-[#8c857e]">
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
    <div className="rounded-xl border border-[#e4e0d8] bg-[#faf8f5] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#f0ece4] text-[#6b6660]">
            {icon}
          </span>
          <div>
            <strong className="block text-xs uppercase tracking-wider text-[#1a1a2e]">{title}</strong>
            <p className="mt-1 mb-0 text-sm leading-relaxed text-[#6b6660]">{selectedLabel || subtitle}</p>
          </div>
        </div>
        <button className="rounded-full border border-[#e8e4dc] bg-white px-4 py-1 text-xs font-bold text-[#6b6660] hover:border-[#4648d4] hover:text-[#4648d4] hover:bg-[#ede9fe] transition" onClick={onToggle} type="button">
          {actionLabel}
        </button>
      </div>
      {isOpen ? <div className="mt-4 grid gap-2 max-h-[260px] overflow-y-auto pr-1">{children}</div> : null}
    </div>
  );
}

function convertMarkdownToHtml(md) {
  if (!md) return "";
  let html = md;
  html = html.replace(/!\[\]\((.*?)\)/g, '<img src="$1" style="max-width:100%; height:auto; display:block; margin:8px 0;" />');
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.split("\n").map(line => {
    if (!line) return "<div><br></div>";
    return `<div>${line}</div>`;
  }).join("");
  return html;
}

function convertHtmlToMarkdown(html) {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const imgs = temp.querySelectorAll("img");
  imgs.forEach(img => {
    const md = `![](${img.src})`;
    img.replaceWith(document.createTextNode(md));
  });

  const bolds = temp.querySelectorAll("strong, b");
  bolds.forEach(b => {
    const md = `**${b.textContent}**`;
    b.replaceWith(document.createTextNode(md));
  });

  const italics = temp.querySelectorAll("em, i");
  italics.forEach(i => {
    const md = `*${i.textContent}*`;
    i.replaceWith(document.createTextNode(md));
  });

  let markdown = "";
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      markdown += node.nodeValue;
    } else if (node.nodeName === "BR") {
      markdown += "\n";
    } else if (node.nodeName === "DIV" || node.nodeName === "P") {
      if (markdown && !markdown.endsWith("\n")) {
        markdown += "\n";
      }
      node.childNodes.forEach(walk);
      if (!markdown.endsWith("\n")) {
        markdown += "\n";
      }
    } else {
      node.childNodes.forEach(walk);
    }
  };
  temp.childNodes.forEach(walk);
  return markdown.replace(/\n\n+/g, "\n\n").trim();
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

  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  const updateField = useCallback((field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }, [setDraft]);

  const updateActiveStates = useCallback(() => {
    if (!bodyRef.current) return;
    setIsBoldActive(document.queryCommandState("bold"));
    setIsItalicActive(document.queryCommandState("italic"));
  }, []);

  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (bodyRef.current) {
      bodyRef.current.innerHTML = convertMarkdownToHtml(draft.body || "");
    }
  }, [draft.body]);

  const handleContentChange = useCallback(() => {
    if (!bodyRef.current) return;
    const html = bodyRef.current.innerHTML;
    const md = convertHtmlToMarkdown(html);
    isInternalChange.current = true;
    updateField("body", md);
  }, [updateField]);

  const wrapSelection = useCallback((before) => {
    if (!bodyRef.current) return;
    bodyRef.current.focus();
    if (before === "**") {
      document.execCommand("bold", false, null);
    } else if (before === "*") {
      document.execCommand("italic", false, null);
    }
    updateActiveStates();
    handleContentChange();
  }, [updateActiveStates, handleContentChange]);

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setImageUploadError("");
    setIsUploadingImage(true);
    try {
      const result = await uploadCommunityImage(file);
      if (bodyRef.current) {
        bodyRef.current.focus();
        document.execCommand("insertImage", false, result.url);
        const imgs = bodyRef.current.querySelectorAll(`img[src="${result.url}"]`);
        imgs.forEach(img => {
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          img.style.margin = "8px 0";
        });
        handleContentChange();
      }
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
    <div className="rounded-2xl border border-[#e4e0d8] bg-white p-5 text-[#1a1a2e] shadow-sm">
      <div className="relative">
        {!isAuthenticated ? (
          <button
            aria-label="Log in to create a community post"
            className="absolute inset-0 z-10 cursor-pointer rounded-2xl bg-transparent"
            onClick={onRequireAuth}
            type="button"
          />
        ) : null}

        <form className="grid gap-4" onSubmit={onSubmit}>
          {!isAuthenticated ? (
            <div className="rounded-xl border border-[#e8e4dc] bg-[#faf8f5] px-4 py-3.5 text-sm text-[#6b6660]">
              Browse the composer first, then sign in when you are ready to publish.
            </div>
          ) : null}

          <div className="grid gap-4 rounded-xl border border-[#e8e4dc] bg-[#faf8f5] p-4 md:p-5">
            <div className="flex flex-wrap gap-2">
              {postTypeButtons.map((option) => (
                <button
                  key={option.value}
                  className={draft.postType === option.value
                    ? "rounded-full bg-[#4648d4] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                    : "rounded-full bg-[#f0ece4] px-4 py-1.5 text-xs font-semibold text-[#6b6660] transition-all hover:bg-[#e8e4dc] hover:text-[#1a1a2e]"}
                  disabled={!isAuthenticated}
                  onClick={() => updatePostType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="grid gap-2 text-sm font-bold text-[#1a1a2e]">
              <div className="flex items-center justify-between gap-3">
                <span>Subjects</span>
                <span className="text-xs font-bold text-[#8c857e]">{selectedSubjects.length}/{MAX_POST_SUBJECTS}</span>
              </div>
              <SubjectMultiSelect
                disabled={!isAuthenticated}
                error={validationErrors.subjectIds}
                onChange={(nextSubjectIds) => updateField("subjectIds", nextSubjectIds)}
                selectedIds={draft.subjectIds}
                subjects={subjects}
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#1a1a2e]">
              <div className="flex items-center justify-between gap-3">
                <span>Title</span>
                <span className="text-xs font-bold text-[#8c857e]">{draft.title.trim().length}/{CREATE_POST_RULES.titleMax}</span>
              </div>
              <input
                className={`rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-[#1a1a2e] outline-none transition focus:border-[#4648d4] focus:shadow-[0_0_0_3px_rgba(70,72,212,0.12)] ${validationErrors.title ? "border-[#ff8c8c]" : "border-[#e4e0d8]"}`}
                disabled={!isAuthenticated}
                maxLength={CREATE_POST_RULES.titleMax}
                placeholder={composerContent.titlePlaceholder}
                value={draft.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
              <FieldError message={validationErrors.title} />
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#1a1a2e]">
                <span>Body</span>
                <span className="text-xs font-bold text-[#8c857e]">{draft.body.trim().length}/{CREATE_POST_RULES.bodyMax}</span>
              </div>

              <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-[#e4e0d8] bg-white px-3 py-1.5">
                <button
                  aria-label="Bold (Ctrl+B)"
                  className={`rounded px-2 py-1 text-sm font-bold transition disabled:opacity-40 ${isBoldActive ? "bg-[#ede9fe] text-[#4648d4] shadow-sm" : "text-[#6b6660] hover:bg-[#f0ece4] hover:text-[#1a1a2e]"}`}
                  disabled={!isAuthenticated}
                  onClick={() => wrapSelection("**", "**")}
                  title="Bold (Ctrl+B)"
                  type="button"
                >
                  B
                </button>
                <button
                  aria-label="Italic (Ctrl+I)"
                  className={`rounded px-2 py-1 text-sm font-bold italic transition disabled:opacity-40 ${isItalicActive ? "bg-[#ede9fe] text-[#4648d4] shadow-sm" : "text-[#6b6660] hover:bg-[#f0ece4] hover:text-[#1a1a2e]"}`}
                  disabled={!isAuthenticated}
                  onClick={() => wrapSelection("*", "*")}
                  title="Italic (Ctrl+I)"
                  type="button"
                >
                  I
                </button>
                <div className="mx-1 h-4 w-px bg-[#e8e4dc]" aria-hidden="true" />
                <button
                  aria-label="Insert image"
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold text-[#6b6660] transition hover:bg-[#f0ece4] hover:text-[#1a1a2e] disabled:opacity-40"
                  disabled={!isAuthenticated || isUploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                  title="Insert image"
                  type="button"
                >
                  {isUploadingImage ? (
                    <svg className="h-4 w-4 animate-spin text-[#4648d4]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

              <div
                ref={bodyRef}
                contentEditable={isAuthenticated}
                className={`-mt-px min-h-[180px] rounded-b-xl rounded-t-none border bg-white px-4 py-2.5 text-sm font-medium text-[#1a1a2e] outline-none transition focus:border-[#4648d4] focus:shadow-[0_0_0_3px_rgba(70,72,212,0.12)] overflow-y-auto composer-editor ${validationErrors.body ? "border-[#ff8c8c]" : "border-[#e4e0d8]"}`}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                placeholder={composerContent.bodyPlaceholder}
                onInput={handleContentChange}
                onSelect={updateActiveStates}
                onKeyUp={updateActiveStates}
                onMouseUp={updateActiveStates}
                onFocus={updateActiveStates}
                onBlur={updateActiveStates}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && (event.key === "b" || event.key === "i")) {
                    setTimeout(() => {
                      updateActiveStates();
                      handleContentChange();
                    }, 0);
                  }
                }}
              />
              {imageUploadError ? <p className="m-0 text-xs font-bold text-[#ef4444]">{imageUploadError}</p> : null}
              <FieldError message={validationErrors.body} />
            </div>

            {draft.postType === "document_share" ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm font-bold text-[#1a1a2e]">Attached document</p>
                <PickerCard
                  actionLabel={isDocumentPickerOpen ? "Hide Files" : "Select Document"}
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
                        ? "rounded-xl border border-transparent bg-[#ede9fe] px-4 py-3 text-left text-sm font-bold text-[#4648d4]"
                        : "rounded-xl border border-[#e8e4dc] bg-white px-4 py-3 text-left text-sm font-semibold text-[#1a1a2e] hover:bg-[#faf8f5] transition-all"}
                      key={doc.id}
                      onClick={() => updateField("documentId", String(doc.id))}
                      type="button"
                    >
                      <span className="block">{doc.title}</span>
                      <span className="mt-1 block text-xs text-[#8c857e]">{doc.subjects?.code || "No subject"} - Ready for sharing</span>
                    </button>
                  )) : (
                    <div className="rounded-xl border border-dashed border-[#e4e0d8] bg-white px-4 py-4 text-sm text-[#8c857e]">
                      {composerContent.attachmentEmpty}
                    </div>
                  )}
                </PickerCard>
                <FieldError message={validationErrors.documentId} />
              </div>
            ) : null}

            {draft.postType === "ai_study_log" ? (
              <div className="grid gap-2">
                <p className="m-0 text-sm font-bold text-[#1a1a2e]">Attached AI session</p>
                <PickerCard
                  actionLabel={isSessionPickerOpen ? "Hide Sessions" : "Attach Session"}
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
                        ? "rounded-xl border border-transparent bg-[#ede9fe] px-4 py-3 text-left text-sm font-bold text-[#4648d4]"
                        : "rounded-xl border border-[#e8e4dc] bg-white px-4 py-3 text-left text-sm font-semibold text-[#1a1a2e] hover:bg-[#faf8f5] transition-all"}
                      key={item.session.id}
                      onClick={() => updateField("chatSessionId", String(item.session.id))}
                      type="button"
                    >
                      <span className="block">{item.session.title}</span>
                      <span className="mt-1 block text-xs text-[#8c857e]">{item.documents.length} linked documents</span>
                    </button>
                  )) : (
                    <div className="rounded-xl border border-dashed border-[#e4e0d8] bg-white px-4 py-4 text-sm text-[#8c857e]">
                      {composerContent.attachmentEmpty}
                    </div>
                  )}
                </PickerCard>
                <FieldError message={validationErrors.chatSessionId} />
              </div>
            ) : null}

            {showPreview && isPreviewOpen ? (
              <div className="rounded-xl border border-[#e8e4dc] bg-[#faf8f5] p-4">
                <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-[#6b6660]">Publish preview</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {publishBadges.map((badge) => (
                    <span className="rounded-full bg-[#f0ece4] px-3 py-1.5 text-xs font-semibold text-[#6b6660]" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-xl border border-[#ff8c8c] bg-[#fff7f7] px-4 py-3 text-sm font-bold text-[#ef4444]">
                {submitError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-3">
                {showPreview ? (
                  <button
                    className="rounded-full border border-[#e8e4dc] bg-white px-4 py-1.5 text-xs font-bold text-[#6b6660] hover:border-[#4648d4] hover:text-[#4648d4] hover:bg-[#ede9fe] transition"
                    onClick={() => setIsPreviewOpen((current) => !current)}
                    type="button"
                  >
                    {isPreviewOpen ? "Hide Preview" : "Preview"}
                  </button>
                ) : null}
                <button
                  className="rounded-xl bg-[#4648d4] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#3537b8] disabled:cursor-not-allowed disabled:bg-[#e8e4dc] disabled:text-[#8c857e]"
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
