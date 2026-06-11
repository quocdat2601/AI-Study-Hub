import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import CommunityFeedRow from "../components/community/CommunityFeedRow.jsx";
import { normalizeThreadPost } from "../components/community/communityThreadViewModel.js";
import { buildCommunityPanelSearch, normalizeCommunityPanel } from "../components/community/communityPanelUtils.js";
import { getUserDisplayName } from "../components/community/communityUtils.js";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { listDocuments } from "../services/documentApi.js";
import { listChatSessions } from "../services/chatApi.js";
import {
  createCommunityPost,
  getCommunityHome,
} from "../services/communityApi.js";

function SearchIcon() {
  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

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

const CREATE_POST_RULES = Object.freeze({
  titleMin: 10,
  titleMax: 255,
  bodyMin: 20,
  bodyMax: 5000,
});

const COMPOSE_TYPE_ALIASES = Object.freeze({
  discussion: "discussion",
  question: "question",
  document: "document_share",
  document_share: "document_share",
  ai_study_log: "ai_study_log",
});

const MAX_POST_SUBJECTS = 3;

function getPostTypeLabel(postType) {
  if (postType === "discussion") return "Discussion";
  if (postType === "document_share") return "Document Share";
  if (postType === "ai_study_log") return "AI Study Log";
  return "Question";
}

function normalizeComposeType(value) {
  return COMPOSE_TYPE_ALIASES[String(value || "").trim().toLowerCase()] || "";
}

function buildComposeSearch(draft) {
  return buildCommunityPanelSearch({
    panel: "new",
    composeType: normalizeComposeType(draft?.postType) || "discussion",
    documentId: draft?.documentId || "",
  });
}

function getComposerContent(postType) {
  if (postType === "discussion") {
    return {
      intro: "Start a free-form study discussion, share an opinion, or open a broader conversation without locking it into one course bucket.",
      titlePlaceholder: "Name the topic, opinion, or discussion you want classmates to join",
      bodyPlaceholder: "Share the context, your perspective, and the discussion you want other students to continue.",
      bodyHint: "Good discussions still benefit from a clear angle, but they do not need a single right answer.",
      attachmentTitle: "No extra attachment required",
      attachmentSubtitle: "Discussions publish directly. Add subjects only if they help people discover the thread.",
      attachmentEmpty: "",
      publishSummary: selectedLabel => selectedLabel
        ? `Publishes a discussion thread with ${selectedLabel} attached.`
        : "Publishes a flexible discussion thread. Subjects are optional.",
    };
  }

  if (postType === "document_share") {
    return {
      intro: "Attach a document that is already extraction-ready, then explain why classmates should trust and use it.",
      titlePlaceholder: "Summarize what this shared material helps people learn",
      bodyPlaceholder: "Explain what the document covers, which course angle it helps with, and how classmates should use it.",
      bodyHint: "Call out scope, quality, and the best study use case so the post reads like a reliable note-share rather than a blind upload.",
      attachmentTitle: "Attach one indexed document",
      attachmentSubtitle: "Choose from your Library items that are already indexed and extraction-ready.",
      attachmentEmpty: "No indexed, extraction-ready documents are available yet.",
      publishSummary: selectedLabel => selectedLabel
        ? `Publishes a document share with ${selectedLabel} attached.`
        : "Select one extraction-ready document before publishing.",
    };
  }

  if (postType === "ai_study_log") {
    return {
      intro: "Turn a useful AI study session into a publishable learning trail with clear context and a practical takeaway.",
      titlePlaceholder: "Name the AI study log you want classmates to open",
      bodyPlaceholder: "Summarize what the AI session clarified, which course problem it addressed, and what made the conversation useful.",
      bodyHint: "Focus on why this session is worth reading, not just that it exists.",
      attachmentTitle: "Attach one AI chat session",
      attachmentSubtitle: "Choose an active chat history thread that you want to publish as a study log.",
      attachmentEmpty: "No AI study sessions are available to attach yet.",
      publishSummary: selectedLabel => selectedLabel
        ? `Publishes an AI study log linked to ${selectedLabel}.`
        : "Select one chat session before publishing.",
    };
  }

  return {
    intro: "Ask like a forum thread: give the course context, describe the problem, and show what you already tried.",
    titlePlaceholder: "State the exact concept or blocker you need help with",
    bodyPlaceholder: "Describe the problem, what you have tried, and where you are still blocked.",
    bodyHint: "Questions with course context, current understanding, and a clear blocker are easier for classmates to answer well.",
    attachmentTitle: "No extra attachment required",
    attachmentSubtitle: "Questions publish directly once title and body are complete. Add subjects only if they help route the question.",
    attachmentEmpty: "",
    publishSummary: () => "Publishes as a question thread. Accepted answers stay available only on question posts.",
  };
}

function validateDraft(draft) {
  const errors = {};
  const titleLength = draft.title.trim().length;
  const bodyLength = draft.body.trim().length;

  if (!titleLength) {
    errors.title = "Title is required.";
  } else if (titleLength < CREATE_POST_RULES.titleMin) {
    errors.title = `Title must be at least ${CREATE_POST_RULES.titleMin} characters.`;
  } else if (titleLength > CREATE_POST_RULES.titleMax) {
    errors.title = `Title must be ${CREATE_POST_RULES.titleMax} characters or fewer.`;
  }

  if (!bodyLength) {
    errors.body = "Body is required.";
  } else if (bodyLength < CREATE_POST_RULES.bodyMin) {
    errors.body = `Body must be at least ${CREATE_POST_RULES.bodyMin} characters.`;
  } else if (bodyLength > CREATE_POST_RULES.bodyMax) {
    errors.body = `Body must be ${CREATE_POST_RULES.bodyMax} characters or fewer.`;
  }

  if (draft.postType === "document_share" && !draft.documentId) {
    errors.documentId = "Select one indexed document to share.";
  }

  if (draft.postType === "ai_study_log" && !draft.chatSessionId) {
    errors.chatSessionId = "Select one AI chat session to publish.";
  }

  if ((draft.subjectIds || []).length > MAX_POST_SUBJECTS) {
    errors.subjectIds = `Select up to ${MAX_POST_SUBJECTS} subjects.`;
  }

  return errors;
}

function mapServerErrorsToFields(message) {
  const normalized = String(message || "").trim();
  if (!normalized) return {};

  if (normalized.includes("subjectIds must contain")) {
    return { subjectIds: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("title must be at least")) {
    return { title: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("title must be") && normalized.includes("characters or fewer")) {
    return { title: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("body must be at least")) {
    return { body: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("body must be") && normalized.includes("characters or fewer")) {
    return { body: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized === "Document not found" || normalized.includes("ready extraction")) {
    return { documentId: normalized };
  }

  if (normalized === "Chat session not found" || normalized.includes("active community study log")) {
    return { chatSessionId: normalized };
  }

  return {};
}

function dedupeSubjectIds(values) {
  return [...new Set((values || []).map((value) => String(value)).filter(Boolean))];
}

function mergeSubjectIds(currentValues, nextValues, limit = MAX_POST_SUBJECTS) {
  return dedupeSubjectIds([...(currentValues || []), ...(nextValues || [])]).slice(0, limit);
}

function getSelectedSubjects(subjects, subjectIds) {
  const selectedSet = new Set((subjectIds || []).map(String));
  return subjects.filter((subject) => selectedSet.has(String(subject.id)));
}

function FieldError({ message }) {
  if (!message) return null;
  return <p className="m-0 text-xs font-bold text-[#ffb4b4]">{message}</p>;
}

function CommunityLoginPromptModal({ isOpen, onClose, loginTarget }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.58)] px-4" role="dialog" aria-modal="true" aria-labelledby="community-compose-login-title">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#66758a]">Login Required</p>
        <h2 className="mt-3 mb-0 text-[28px] font-extrabold leading-[1.05] text-[#172033]" id="community-compose-login-title">
          Sign in to publish to the community
        </h2>
        <p className="mt-4 mb-0 text-sm leading-6 text-[#526173]">
          Your course context and post type will still be waiting for you after login.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[#172033] px-5 py-3 text-sm font-extrabold text-white no-underline"
            state={{ from: loginTarget }}
            to="/login"
          >
            Continue to login
          </Link>
          <button className="inline-flex items-center justify-center rounded-full border border-[#dbe3ed] px-5 py-3 text-sm font-extrabold text-[#172033]" onClick={onClose} type="button">
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterPill({ isActive, children, onClick }) {
  return (
    <button
      className={isActive
        ? "rounded-full bg-[#172033] px-4 py-2 text-sm font-extrabold text-white"
        : "rounded-full bg-[#f2f5f8] px-4 py-2 text-sm font-bold text-[#172033]"}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SortTab({ isActive, label, onClick }) {
  return (
    <button
      className={isActive
        ? "border-0 border-b-2 border-[#172033] bg-transparent px-1 pb-2 text-sm font-extrabold text-[#172033]"
        : "border-0 border-b-2 border-transparent bg-transparent px-1 pb-2 text-sm font-bold text-[#66758a]"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
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
              if (!disabled) {
                setIsOpen(true);
              }
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

function getPanelBannerContent(panel) {
  if (panel === "new") {
    return {
      title: "Create a community post",
      description: "Open a new discussion, ask a question, or publish a document or AI study log without leaving the community feed.",
    };
  }

  if (panel === "people") {
    return {
      title: "Top contributors",
      description: "See who is actively helping classmates, sharing useful resources, and keeping the study space moving.",
    };
  }

  return {
    title: "New discussions",
    description: "Track active study threads, tighten the feed with filters, and jump into the right discussion quickly.",
  };
}

function CommunityComposer({
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
  loginTarget,
  showHeader = true,
}) {
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
    <section className="rounded-[24px] border border-[#c7c4d7] bg-[#172033] p-5 text-white shadow-[0_24px_45px_rgba(20,31,48,0.18)]">
      {showHeader ? (
        <div>
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#99a6ba]">New Post</p>
          <h2 className="mt-2 mb-0 text-[22px] font-extrabold">Create a community post</h2>
          <p className="mt-3 mb-0 max-w-3xl text-sm leading-6 text-[#c9d5e4]">{composerContent.intro}</p>
        </div>
      ) : null}

      <div className={`relative ${showHeader ? "mt-5" : ""}`}>
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
              Browse the composer first, then sign in when you are ready to publish. Any click inside the form opens the login prompt.
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
              <p className="m-0 text-xs leading-5 text-[#9fb0c3]">Attach up to {MAX_POST_SUBJECTS} course subjects if they help classmates discover this post.</p>
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

            <label className="grid gap-2 text-sm font-bold">
              <div className="flex items-center justify-between gap-3">
                <span>Body</span>
                <span className="text-xs font-black text-[#9fb0c3]">{draft.body.trim().length}/{CREATE_POST_RULES.bodyMax}</span>
              </div>
              <textarea
                className={`min-h-[160px] rounded-2xl border bg-white px-4 py-3 text-[#172033] ${validationErrors.body ? "border-[#ff8c8c]" : "border-[#43526a]"}`}
                disabled={!isAuthenticated}
                maxLength={CREATE_POST_RULES.bodyMax}
                placeholder={composerContent.bodyPlaceholder}
                value={draft.body}
                onChange={(event) => updateField("body", event.target.value)}
              />
              <p className="m-0 text-xs leading-5 text-[#9fb0c3]">{composerContent.bodyHint}</p>
              <FieldError message={validationErrors.body} />
            </label>

            {draft.postType === "document_share" ? (
              <div className="grid gap-2">
                <div>
                  <p className="m-0 text-sm font-extrabold text-white">Attached Document</p>
                  <p className="mt-1 mb-0 text-xs leading-5 text-[#9fb0c3]">{composerContent.attachmentSubtitle}</p>
                </div>
                <PickerCard
                  actionLabel={isDocumentPickerOpen ? "Hide Library Files" : "Select Indexed Document"}
                  icon={<AttachmentIcon />}
                  isOpen={isDocumentPickerOpen}
                  onToggle={() => setIsDocumentPickerOpen((current) => !current)}
                  selectedLabel={selectedDocument ? selectedDocument.title : ""}
                  subtitle={composerContent.attachmentSubtitle}
                  title={composerContent.attachmentTitle}
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
                <div>
                  <p className="m-0 text-sm font-extrabold text-white">Attached AI Session</p>
                  <p className="mt-1 mb-0 text-xs leading-5 text-[#9fb0c3]">{composerContent.attachmentSubtitle}</p>
                </div>
                <PickerCard
                  actionLabel={isSessionPickerOpen ? "Hide AI Sessions" : "Attach Conversation"}
                  icon={<SparkIcon />}
                  isOpen={isSessionPickerOpen}
                  onToggle={() => setIsSessionPickerOpen((current) => !current)}
                  selectedLabel={selectedSession ? selectedSession.session.title : ""}
                  subtitle={composerContent.attachmentSubtitle}
                  title={composerContent.attachmentTitle}
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

            {["discussion", "question"].includes(draft.postType) ? (
              <div className="rounded-[22px] border border-dashed border-[rgba(255,255,255,0.16)] px-4 py-4 text-sm leading-6 text-[#d5deea]">
                {composerContent.attachmentSubtitle}
              </div>
            ) : null}

            {isPreviewOpen ? (
              <div className="rounded-[18px] border border-[#324255] bg-[#101722] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#99a6ba]">Preview</p>
                  <button
                    className="rounded-full border border-[rgba(255,255,255,0.14)] bg-transparent px-3 py-1 text-xs font-extrabold text-[#d5deea]"
                    onClick={() => setIsPreviewOpen(false)}
                    type="button"
                  >
                    Hide
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {publishBadges.map((badge) => (
                    <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-extrabold text-white" key={badge}>
                      {badge}
                    </span>
                  ))}
                  {selectedSubjects.map((subject) => (
                    <span className="rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-extrabold text-white" key={`preview-subject-${subject.id}`}>
                      {subject.code}
                    </span>
                  ))}
                </div>
                <p className="mt-3 mb-0 text-sm leading-6 text-[#d5deea]">
                  {composerContent.publishSummary(selectedDocument?.title || selectedSession?.session?.title)}
                </p>
              </div>
            ) : null}
          </div>

          {submitError ? <div className="rounded-2xl bg-[#5b1f1f] px-4 py-3 text-sm font-bold text-[#ffd8d8]">{submitError}</div> : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white"
                onClick={() => setIsPreviewOpen((current) => !current)}
                type="button"
              >
                {isPreviewOpen ? "Hide Preview" : "Preview"}
              </button>

              {!isAuthenticated ? (
                <button className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-extrabold text-white" onClick={onRequireAuth} type="button">
                  Log in to continue
                </button>
              ) : (
                <button className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#172033]" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Publishing..." : "Publish to Community"}
                </button>
              )}
            </div>

            {!isAuthenticated ? (
              <Link
                className="text-sm font-bold text-[#d6deeb] no-underline"
                state={{ from: loginTarget }}
                to="/login"
              >
                Open login page instead
              </Link>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

const DEFAULT_SORT = "latest";
const DEFAULT_TYPE = "all";

export default function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const composeSearchParam = normalizeComposeType(searchParams.get("compose"));
  const activePanel = normalizeCommunityPanel(searchParams.get("panel"), composeSearchParam ? "new" : "find");
  const [communityData, setCommunityData] = useState({ feed: [], subjects: [], topContributors: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [draft, setDraft] = useState({
    postType: "discussion",
    subjectIds: [],
    title: "",
    body: "",
    documentId: "",
    chatSessionId: "",
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [filterState, setFilterState] = useState({
    search: "",
    type: DEFAULT_TYPE,
    subject: code || null,
    sort: DEFAULT_SORT,
  });
  const deferredSearch = useDeferredValue(filterState.search);
  const displayName = getUserDisplayName(user);
  const loginTarget = useMemo(() => ({
    pathname: location.pathname,
    search: buildComposeSearch(draft),
  }), [draft, location.pathname]);

  useEffect(() => {
    setFilterState((current) => ({
      ...current,
      subject: code || null,
    }));
  }, [code]);

  useEffect(() => {
    if (!["all", "question"].includes(filterState.type) && ["unanswered", "solved"].includes(filterState.sort)) {
      setFilterState((current) => ({
        ...current,
        sort: DEFAULT_SORT,
      }));
    }
  }, [filterState.type, filterState.sort]);

  useEffect(() => {
    let isMounted = true;

    async function loadCommunity() {
      setIsLoading(true);
      setError("");
      try {
        const data = await getCommunityHome({
          tab: filterState.sort,
          postType: filterState.type === DEFAULT_TYPE ? undefined : filterState.type,
          subject: filterState.subject || undefined,
          search: deferredSearch || undefined,
          limit: 30,
        });
        if (isMounted) {
          setCommunityData({
            feed: Array.isArray(data.feed) ? data.feed : [],
            subjects: Array.isArray(data.subjects) ? data.subjects : [],
            topContributors: Array.isArray(data.topContributors) ? data.topContributors : [],
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || "Could not load community posts.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCommunity();
    return () => {
      isMounted = false;
    };
  }, [filterState.sort, filterState.subject, filterState.type, deferredSearch]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated) return undefined;

    async function loadComposerSources() {
      try {
        const [documentData, sessionData] = await Promise.all([
          listDocuments(),
          listChatSessions(),
        ]);
        if (isMounted) {
          setDocuments(Array.isArray(documentData) ? documentData : []);
          setSessions(Array.isArray(sessionData) ? sessionData : []);
        }
      } catch {
        if (isMounted) {
          setDocuments([]);
          setSessions([]);
        }
      }
    }

    loadComposerSources();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const documentId = searchParams.get("documentId");
    if (!composeSearchParam) return;

    setDraft((current) => ({
      ...current,
      postType: composeSearchParam,
      documentId: composeSearchParam === "document_share" ? (documentId || "") : "",
      chatSessionId: composeSearchParam === "ai_study_log" ? current.chatSessionId : "",
    }));
  }, [composeSearchParam, searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoginPromptOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setValidationErrors({});
    setSubmitError("");
  }, [draft.postType, draft.subjectIds, draft.title, draft.body, draft.documentId, draft.chatSessionId]);

  useEffect(() => {
    if (draft.subjectIds.length || !filterState.subject || !communityData.subjects.length) return;
    const matchingSubject = communityData.subjects.find((subject) => String(subject.code) === String(filterState.subject));
    if (!matchingSubject) return;

    setDraft((current) => (
      current.subjectIds.length
        ? current
        : { ...current, subjectIds: [String(matchingSubject.id)] }
    ));
  }, [communityData.subjects, draft.subjectIds, filterState.subject]);

  useEffect(() => {
    if (draft.subjectIds.length || draft.postType !== "document_share" || !draft.documentId) return;

    const matchingDocument = documents.find((doc) => String(doc.id) === String(draft.documentId));
    const nextSubjectId = matchingDocument?.subject_id || matchingDocument?.subjects?.id;
    if (!nextSubjectId) return;

    setDraft((current) => (
      current.subjectIds.length
        ? current
        : { ...current, subjectIds: mergeSubjectIds(current.subjectIds, [String(nextSubjectId)]) }
    ));
  }, [documents, draft.documentId, draft.postType, draft.subjectIds]);

  useEffect(() => {
    if (draft.subjectIds.length || draft.postType !== "ai_study_log" || !draft.chatSessionId) return;

    const matchingSession = sessions.find((item) => String(item.session.id) === String(draft.chatSessionId));
    if (!matchingSession) return;

    const suggestedSubjectIds = (matchingSession.documents || [])
      .map((document) => document.subjectId || document.subject_id || document.subject?.id || document.subjects?.id)
      .filter(Boolean)
      .map((value) => String(value));

    if (!suggestedSubjectIds.length) return;

    setDraft((current) => (
      current.subjectIds.length
        ? current
        : { ...current, subjectIds: mergeSubjectIds(current.subjectIds, suggestedSubjectIds) }
    ));
  }, [draft.chatSessionId, draft.postType, draft.subjectIds, sessions]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateDraft(draft);
    if (Object.keys(nextErrors).length) {
      setValidationErrors(nextErrors);
      setSubmitError("");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setValidationErrors({});

    try {
      const created = await createCommunityPost({
        postType: draft.postType,
        subjectIds: draft.subjectIds,
        title: draft.title,
        body: draft.body,
        documentId: draft.postType === "document_share" ? draft.documentId : undefined,
        chatSessionId: draft.postType === "ai_study_log" ? draft.chatSessionId : undefined,
      });
      navigate(`/community/posts/${created.id}`);
    } catch (err) {
      const message = err.response?.data?.error || "Could not publish your post.";
      const nextFieldErrors = mapServerErrorsToFields(message);
      if (Object.keys(nextFieldErrors).length) {
        setValidationErrors(nextFieldErrors);
        setSubmitError("");
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function getCommunityPath(nextSubjectCode = code || null) {
    return nextSubjectCode ? `/community/subjects/${nextSubjectCode}` : "/community";
  }

  function updateFilters(updates) {
    setFilterState((current) => ({
      ...current,
      ...updates,
    }));
  }

  function setSubjectFilter(nextSubject) {
    if (!nextSubject) {
      navigate({
        pathname: "/community",
        search: buildCommunityPanelSearch({ panel: "find" }),
      });
      updateFilters({ subject: null });
      return;
    }

    navigate({
      pathname: `/community/subjects/${nextSubject}`,
      search: buildCommunityPanelSearch({ panel: "find" }),
    });
    updateFilters({ subject: nextSubject });
  }

  function clearFilters() {
    navigate({
      pathname: "/community",
      search: buildCommunityPanelSearch({ panel: "find" }),
    });
    setFilterState({
      search: "",
      type: DEFAULT_TYPE,
      subject: null,
      sort: DEFAULT_SORT,
    });
  }

  const searchLower = deferredSearch.trim().toLowerCase();
  const visibleFeed = useMemo(() => {
    if (!searchLower) return communityData.feed;

    return (communityData.feed || []).filter((post) => {
      const haystack = [
        post.title,
        post.body,
        post.excerpt,
        post.subject?.code,
        post.subject?.name,
        ...(post.subjects || []).flatMap((subject) => [subject?.code, subject?.name]),
        post.documentAttachment?.title,
        post.documentAttachment?.subjectCode,
        post.documentAttachment?.previewText,
        post.chatAttachment?.session?.title,
        post.chatAttachment?.previewText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchLower);
    });
  }, [communityData.feed, searchLower]);

  const canUseQuestionStateSort = filterState.type === "all" || filterState.type === "question";
  const hasActiveFilterContext = Boolean(
    filterState.search.trim()
    || filterState.subject
    || filterState.type !== DEFAULT_TYPE
    || filterState.sort !== DEFAULT_SORT
  );

  function handleSidebarSectionChange(sectionId) {
    if (!sectionId || sectionId === "community") return;
    navigate("/dashboard", {
      state: { activeSection: sectionId },
    });
  }

  const bannerContent = getPanelBannerContent(activePanel);
  const bannerNavItems = [
    { id: "find", label: "Find", isActive: activePanel === "find", to: `${getCommunityPath()}${buildCommunityPanelSearch({ panel: "find" })}` },
    { id: "new", label: "New Post", isActive: activePanel === "new", to: `${getCommunityPath()}${buildCommunityPanelSearch({ panel: "new", composeType: normalizeComposeType(draft.postType) || "discussion", documentId: draft.documentId })}` },
    { id: "people", label: "Top Contributors", isActive: activePanel === "people", to: `${getCommunityPath()}${buildCommunityPanelSearch({ panel: "people" })}` },
  ];
  const shellClass = isAuthenticated
    ? (isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:64px_minmax(0,1fr)] [scrollbar-gutter:stable]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:224px_minmax(0,1fr)] [scrollbar-gutter:stable]")
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [scrollbar-gutter:stable]";
  const contentClass = isAuthenticated
    ? (isSidebarCollapsed ? "px-4 py-4 lg:px-6" : "p-5 lg:p-6")
    : "px-4 py-5 md:px-8";

  return (
    <main className={shellClass}>
      {isAuthenticated ? (
        <DashboardSidebar
          activeSection="community"
          isCollapsed={isSidebarCollapsed}
          onSectionChange={handleSidebarSectionChange}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          userName={displayName}
          newDocumentTo="/library"
          newDocumentLabel="Upload Document"
        />
      ) : null}

      <section className={contentClass}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-5">
          <CommunityLoginPromptModal
            isOpen={isLoginPromptOpen}
            loginTarget={loginTarget}
            onClose={() => setIsLoginPromptOpen(false)}
          />

          <CommunityBanner
            title={bannerContent.title}
            description={bannerContent.description}
            navItems={bannerNavItems}
            LinkComponent={Link}
          >
          {activePanel === "find" ? (
            <div className="grid gap-4">
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#66758a]">
                  <SearchIcon />
                </span>
                <input
                  className="w-full rounded-[20px] border border-[#dbe3ed] bg-[#f8fafc] py-3 pl-12 pr-4 text-sm font-medium text-[#172033] outline-none transition focus:border-[#172033] focus:bg-white"
                  onChange={(event) => updateFilters({ search: event.target.value })}
                  placeholder="Search questions, course codes, or study materials..."
                  value={filterState.search}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <FilterPill isActive={filterState.type === "all"} onClick={() => updateFilters({ type: "all" })}>All Posts</FilterPill>
                  <FilterPill isActive={filterState.type === "discussion"} onClick={() => updateFilters({ type: "discussion", sort: DEFAULT_SORT })}>Discussions</FilterPill>
                  <FilterPill isActive={filterState.type === "question"} onClick={() => updateFilters({ type: "question" })}>Questions</FilterPill>
                  <FilterPill isActive={filterState.type === "document_share"} onClick={() => updateFilters({ type: "document_share", sort: DEFAULT_SORT })}>Document Shares</FilterPill>
                  <FilterPill isActive={filterState.type === "ai_study_log"} onClick={() => updateFilters({ type: "ai_study_log", sort: DEFAULT_SORT })}>AI Study Logs</FilterPill>
                </div>

                {hasActiveFilterContext ? (
                  <button className="inline-flex items-center gap-2 rounded-full bg-[#eef2f7] px-3 py-2 text-xs font-extrabold text-[#42526a]" onClick={clearFilters} type="button">
                    <span>x</span>
                    <span>Clear Filters</span>
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <SortTab isActive={filterState.sort === "latest"} label="Latest" onClick={() => updateFilters({ sort: "latest" })} />
                  <SortTab isActive={filterState.sort === "trending"} label="Trending" onClick={() => updateFilters({ sort: "trending" })} />
                  {canUseQuestionStateSort ? (
                    <>
                      <SortTab isActive={filterState.sort === "unanswered"} label="Unanswered" onClick={() => updateFilters({ sort: "unanswered" })} />
                      <SortTab isActive={filterState.sort === "solved"} label="Solved" onClick={() => updateFilters({ sort: "solved" })} />
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {filterState.subject ? (
                    <span className="rounded-full bg-[#e8efff] px-3 py-2 text-xs font-extrabold text-[#172033]">
                      Subject: {filterState.subject}
                    </span>
                  ) : null}
                  {filterState.search.trim() ? (
                    <span className="rounded-full bg-[#eef2f7] px-3 py-2 text-xs font-extrabold text-[#42526a]">
                      Search: {filterState.search.trim()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {communityData.subjects.map((subject) => (
                  <button
                    className={filterState.subject === subject.code
                      ? "rounded-full bg-[#e8efff] px-4 py-2 text-sm font-extrabold text-[#172033]"
                      : "rounded-full bg-[#f2f5f8] px-4 py-2 text-sm font-bold text-[#172033]"}
                    key={subject.id}
                    onClick={() => setSubjectFilter(subject.code)}
                    type="button"
                  >
                    {subject.code} <span className="text-[#66758a]">{subject.postCount}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activePanel === "new" ? (
            <div>
              <CommunityComposer
                documents={documents}
                draft={draft}
                isAuthenticated={isAuthenticated}
                isSubmitting={isSubmitting}
                loginTarget={loginTarget}
                onRequireAuth={() => setIsLoginPromptOpen(true)}
                sessions={sessions}
                setDraft={setDraft}
                showHeader={false}
                subjects={communityData.subjects}
                submitError={submitError}
                validationErrors={validationErrors}
                onSubmit={handleSubmit}
              />
            </div>
          ) : null}

          {activePanel === "people" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {communityData.topContributors.map((person, index) => (
                <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[20px] bg-[#f7f9fb] px-4 py-4" key={person.id}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#172033] text-sm font-black text-white">{index + 1}</span>
                  <div>
                    <strong className="block text-sm text-[#172033]">{person.displayName}</strong>
                    <span className="text-xs text-[#66758a]">{person.email}</span>
                  </div>
                  <span className="text-xs font-extrabold text-[#4648d4]">{person.score} pts</span>
                </div>
              ))}
            </div>
          ) : null}
          </CommunityBanner>

          {error ? <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{error}</div> : null}

          <section className="grid gap-4">
            {isLoading ? (
              <>
                {[0, 1, 2].map((item) => (
                  <div className="h-[220px] rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" key={item} />
                ))}
              </>
            ) : visibleFeed.length ? (
              visibleFeed.map((post) => (
                <CommunityFeedRow
                  key={post.id}
                  variant="light"
                  LinkComponent={Link}
                  showExcerpt={false}
                  thread={normalizeThreadPost({
                    ...post,
                    href: `/community/posts/${post.id}`,
                  })}
                />
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#c7d2e2] bg-white px-6 py-10 text-center">
                <h2 className="m-0 text-2xl font-extrabold text-[#172033]">Nothing here yet</h2>
                <p className="mt-3 mb-0 text-sm text-[#66758a]">Change a filter or publish the first thread for this study space.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
