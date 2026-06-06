import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardSidebar from "../components/dashboard/DashboardSidebar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { listDocuments } from "../services/documentApi.js";
import { listChatSessions } from "../services/chatApi.js";
import {
  createCommunityPost,
  getCommunityHome,
  toggleCommunityPostVote,
} from "../services/communityApi.js";

function getDisplayName(user) {
  if (user?.email) {
    return user.email.split("@")[0].replace(/[._-]+/g, " ");
  }
  return "Student";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

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

function CommunityFeedCard({ post, canVote, onVote }) {
  return (
    <article className="rounded-[20px] border border-[#dbe3ed] bg-white p-5 shadow-[0_18px_40px_rgba(20,31,48,0.08)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-[#e8efff] px-3 py-1 text-[#4648d4]">{post.subject?.code || "General"}</span>
        <span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-[#42526a]">
          {post.postType === "question" ? "Question" : post.postType === "document_share" ? "Document" : "AI Study Log"}
        </span>
        {post.solved ? <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[#087443]">Solved</span> : null}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link className="text-[22px] font-extrabold leading-tight text-[#172033] no-underline" to={`/community/posts/${post.id}`}>
            {post.title}
          </Link>
          <p className="mt-3 mb-0 text-sm leading-6 text-[#526173]">{post.excerpt}</p>
        </div>

        <div className="min-w-[74px] rounded-2xl border border-[#dbe3ed] bg-[#f7f9fb] px-3 py-2 text-center">
          <div className="text-xl font-black text-[#172033]">{post.voteCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#66758a]">Votes</div>
        </div>
      </div>

      {post.documentAttachment ? (
        <div className="mt-4 rounded-2xl border border-[#dbe3ed] bg-[#f9fbff] p-4">
          <div className="flex items-center gap-4">
            {post.documentAttachment.thumbnailUrl ? (
              <img className="h-20 w-16 rounded-lg border border-[#dbe3ed] object-cover" src={post.documentAttachment.thumbnailUrl} alt="" />
            ) : (
              <div className="flex h-20 w-16 items-end justify-center rounded-lg border border-[#dbe3ed] bg-white pb-2 text-xs font-black text-[#4648d4]">
                {post.documentAttachment.fileType}
              </div>
            )}
            <div className="min-w-0">
              <strong className="block text-sm text-[#172033]">{post.documentAttachment.title}</strong>
              <span className="mt-1 block text-xs text-[#66758a]">{post.documentAttachment.subjectCode || post.documentAttachment.subject || "Study Resource"}</span>
              <p className="mt-2 mb-0 text-xs leading-5 text-[#526173]">{post.documentAttachment.previewText}</p>
            </div>
          </div>
        </div>
      ) : null}

      {post.chatAttachment ? (
        <div className="mt-4 rounded-2xl border border-[#dbe3ed] bg-[#fffaf0] p-4">
          <strong className="block text-sm text-[#172033]">{post.chatAttachment.session.title}</strong>
          <p className="mt-2 mb-0 text-xs leading-5 text-[#526173]">{post.chatAttachment.previewText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(post.chatAttachment.documents || []).slice(0, 3).map((doc) => (
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#42526a]" key={doc.id}>
                {doc.subjectCode || doc.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f7] pt-4">
        <div className="text-xs text-[#66758a]">
          <strong className="text-[#172033]">{post.author?.displayName || "Student"}</strong> - {formatDate(post.createdAt)} - {post.replyCount} replies
        </div>
        <div className="flex gap-3">
          {canVote ? (
            <button
              className="rounded-full border border-[#dbe3ed] bg-white px-4 py-2 text-xs font-extrabold text-[#172033]"
              onClick={() => onVote(post.id)}
              type="button"
            >
              Upvote
            </button>
          ) : null}
          <Link className="rounded-full bg-[#172033] px-4 py-2 text-xs font-extrabold text-white no-underline" to={`/community/posts/${post.id}`}>
            Open Discussion
          </Link>
        </div>
      </div>
    </article>
  );
}

function ControlTabButton({ isActive, label, onClick }) {
  return (
    <button
      className={isActive
        ? "rounded-full bg-[#172033] px-4 py-2 text-sm font-extrabold text-white"
        : "rounded-full border border-[#dbe3ed] bg-white px-4 py-2 text-sm font-extrabold text-[#172033]"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
}) {
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [isSessionPickerOpen, setIsSessionPickerOpen] = useState(false);

  const readyDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "indexed" && doc.extraction_status === "ready"),
    [documents]
  );

  const selectedDocument = readyDocuments.find((doc) => String(doc.id) === String(draft.documentId));
  const selectedSession = sessions.find((item) => String(item.session.id) === String(draft.chatSessionId));
  const titlePlaceholder = draft.postType === "question"
    ? "What are you trying to understand?"
    : draft.postType === "document_share"
      ? "Give this shared material a clear title"
      : "Name the AI conversation you want to publish";
  const bodyPlaceholder = draft.postType === "question"
    ? "Add context, the course angle, and what you have already tried."
    : draft.postType === "document_share"
      ? "Explain why this document matters, what it covers, and how classmates should use it."
      : "Summarize what this AI study log helped you solve or clarify.";

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
      <div>
        <p className="m-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#99a6ba]">New Post</p>
        <h2 className="mt-2 mb-0 text-[22px] font-extrabold">Share what helped you learn</h2>
      </div>

      {!isAuthenticated ? (
        <div className="mt-5 rounded-2xl bg-[rgba(255,255,255,0.06)] p-4">
          <p className="m-0 text-sm leading-6 text-[#d6deeb]">Sign in to ask questions, share documents, or publish AI study logs.</p>
          <Link className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#172033] no-underline" to="/login">
            Log in to contribute
          </Link>
        </div>
      ) : (
        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-bold">
            Post Type
            <select
              className="rounded-2xl border border-[#43526a] bg-white px-4 py-3 text-[#172033]"
              value={draft.postType}
              onChange={(event) => updatePostType(event.target.value)}
            >
              <option value="question">Question</option>
              <option value="document_share">Document Share</option>
              <option value="ai_study_log">AI Study Log</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Subject
            <select
              className="rounded-2xl border border-[#43526a] bg-white px-4 py-3 text-[#172033]"
              value={draft.subjectId}
              onChange={(event) => setDraft((current) => ({ ...current, subjectId: event.target.value }))}
            >
              <option value="">No subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>
              ))}
            </select>
          </label>

          {draft.postType === "document_share" ? (
            <PickerCard
              actionLabel={isDocumentPickerOpen ? "Hide Library Files" : "Select Indexed Document"}
              icon={<AttachmentIcon />}
              isOpen={isDocumentPickerOpen}
              onToggle={() => setIsDocumentPickerOpen((current) => !current)}
              selectedLabel={selectedDocument ? `${selectedDocument.title}` : ""}
              subtitle="Select an indexed document from Library that already has extraction-ready text."
              title="Select an Indexed Document from Library"
            >
              {readyDocuments.length ? readyDocuments.map((doc) => (
                <button
                  className={String(draft.documentId) === String(doc.id)
                    ? "rounded-2xl border border-white bg-white px-4 py-3 text-left text-sm font-extrabold text-[#172033]"
                    : "rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-sm font-bold text-white"}
                  key={doc.id}
                  onClick={() => setDraft((current) => ({ ...current, documentId: String(doc.id) }))}
                  type="button"
                >
                  <span className="block">{doc.title}</span>
                  <span className="mt-1 block text-xs text-[#99a6ba]">{doc.subjects?.code || "No subject"} - Ready for sharing</span>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.16)] px-4 py-4 text-sm text-[#d5deea]">
                  No indexed, extraction-ready documents available yet.
                </div>
              )}
            </PickerCard>
          ) : null}

          {draft.postType === "ai_study_log" ? (
            <PickerCard
              actionLabel={isSessionPickerOpen ? "Hide AI Sessions" : "Attach Conversation"}
              icon={<SparkIcon />}
              isOpen={isSessionPickerOpen}
              onToggle={() => setIsSessionPickerOpen((current) => !current)}
              selectedLabel={selectedSession ? `${selectedSession.session.title}` : ""}
              subtitle="Attach an AI conversation link from one of your active chat history threads."
              title="Attach an AI Conversation Link"
            >
              {sessions.length ? sessions.map((item) => (
                <button
                  className={String(draft.chatSessionId) === String(item.session.id)
                    ? "rounded-2xl border border-white bg-white px-4 py-3 text-left text-sm font-extrabold text-[#172033]"
                    : "rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-left text-sm font-bold text-white"}
                  key={item.session.id}
                  onClick={() => setDraft((current) => ({ ...current, chatSessionId: String(item.session.id) }))}
                  type="button"
                >
                  <span className="block">{item.session.title}</span>
                  <span className="mt-1 block text-xs text-[#99a6ba]">{item.documents.length} linked documents</span>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.16)] px-4 py-4 text-sm text-[#d5deea]">
                  No AI study sessions available to attach yet.
                </div>
              )}
            </PickerCard>
          ) : null}

          <label className="grid gap-2 text-sm font-bold">
            Title
            <input
              className="rounded-2xl border border-[#43526a] bg-white px-4 py-3 text-[#172033]"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder={titlePlaceholder}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Body
            <textarea
              className="min-h-[132px] rounded-2xl border border-[#43526a] bg-white px-4 py-3 text-[#172033]"
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              placeholder={bodyPlaceholder}
              required
            />
          </label>

          {submitError ? <div className="rounded-2xl bg-[#5b1f1f] px-4 py-3 text-sm font-bold text-[#ffd8d8]">{submitError}</div> : null}

          <button className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-extrabold text-[#172033]" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Publishing..." : "Publish to Community"}
          </button>
        </form>
      )}
    </section>
  );
}

const DEFAULT_SORT = "latest";
const DEFAULT_TYPE = "all";

export default function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [communityData, setCommunityData] = useState({ feed: [], subjects: [], topContributors: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState({
    postType: "question",
    subjectId: "",
    title: "",
    body: "",
    documentId: "",
    chatSessionId: "",
  });
  const [activePanel, setActivePanel] = useState("find");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHeroCompact, setIsHeroCompact] = useState(false);
  const [filterState, setFilterState] = useState({
    search: "",
    type: DEFAULT_TYPE,
    subject: code || null,
    sort: DEFAULT_SORT,
  });
  const deferredSearch = useDeferredValue(filterState.search);
  const displayName = getDisplayName(user);

  useEffect(() => {
    const handleScroll = () => {
      setIsHeroCompact(window.scrollY > 72);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
    const compose = searchParams.get("compose");
    const documentId = searchParams.get("documentId");
    if (compose === "document" && documentId) {
      setActivePanel("new");
      setDraft((current) => ({
        ...current,
        postType: "document_share",
        documentId,
      }));
    }
  }, [searchParams]);

  async function refreshCommunity(nextFilters = filterState) {
    const refreshed = await getCommunityHome({
      tab: nextFilters.sort,
      postType: nextFilters.type === DEFAULT_TYPE ? undefined : nextFilters.type,
      subject: nextFilters.subject || undefined,
      search: nextFilters.search || undefined,
      limit: 30,
    });
    setCommunityData({
      feed: Array.isArray(refreshed.feed) ? refreshed.feed : [],
      subjects: Array.isArray(refreshed.subjects) ? refreshed.subjects : [],
      topContributors: Array.isArray(refreshed.topContributors) ? refreshed.topContributors : [],
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const created = await createCommunityPost({
        postType: draft.postType,
        subjectId: draft.subjectId || undefined,
        title: draft.title,
        body: draft.body,
        documentId: draft.postType === "document_share" ? draft.documentId : undefined,
        chatSessionId: draft.postType === "ai_study_log" ? draft.chatSessionId : undefined,
      });
      navigate(`/community/posts/${created.id}`);
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Could not publish your post.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVote(postId) {
    try {
      await toggleCommunityPostVote(postId);
      await refreshCommunity();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update vote.");
    }
  }

  function updateFilters(updates) {
    setFilterState((current) => ({
      ...current,
      ...updates,
    }));
  }

  function setSubjectFilter(nextSubject) {
    if (!nextSubject) {
      navigate("/community");
      updateFilters({ subject: null });
      return;
    }

    navigate(`/community/subjects/${nextSubject}`);
    updateFilters({ subject: nextSubject });
  }

  function clearFilters() {
    navigate("/community");
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

  const shellClass = isAuthenticated
    ? (isSidebarCollapsed
      ? "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:64px_minmax(0,1fr)]"
      : "grid min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e] [grid-template-columns:224px_minmax(0,1fr)]")
    : "min-h-[calc(100vh-64px)] bg-[#f7f9fb] text-[#191c1e]";
  const contentClass = isAuthenticated
    ? (isSidebarCollapsed ? "grid gap-4 px-4 py-4 lg:px-6" : "grid gap-4 p-5 lg:p-6")
    : "mx-auto grid max-w-[1380px] gap-4 px-4 py-5 md:px-8";

  return (
    <main className={shellClass}>
      {isAuthenticated ? (
        <DashboardSidebar
          activeSection="community"
          isCollapsed={isSidebarCollapsed}
          onSectionChange={() => {}}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          userName={displayName}
          newDocumentTo="/library"
          newDocumentLabel="Upload Document"
        />
      ) : null}

      <section className={contentClass}>
        <header
          className={isHeroCompact
            ? "rounded-[24px] bg-[linear-gradient(135deg,#172033_0%,#344154_55%,#4b5f79_100%)] px-5 py-4 text-white shadow-[0_24px_44px_rgba(20,31,48,0.16)] transition-all duration-300 md:px-6"
            : "rounded-[24px] bg-[linear-gradient(135deg,#172033_0%,#344154_55%,#4b5f79_100%)] px-5 py-5 text-white shadow-[0_24px_44px_rgba(20,31,48,0.16)] transition-all duration-300 md:px-7 md:py-6"}
        >
          <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#c3d0e2]">Community</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className={isHeroCompact ? "m-0 max-w-3xl text-[26px] font-extrabold leading-[1.02] transition-all duration-300" : "m-0 max-w-3xl text-[32px] font-extrabold leading-[1.02] transition-all duration-300"}>
                Study questions, verified notes, and publishable AI learning trails.
              </h1>
              <p className={isHeroCompact ? "mt-0 max-h-0 overflow-hidden opacity-0 transition-all duration-300" : "mt-2 mb-0 max-w-2xl text-sm leading-6 text-[#d5deea] transition-all duration-300"}>
                Browse what students are asking, what notes are worth saving, and how strong study prompts actually played out.
              </p>
            </div>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{error}</div> : null}

        <section className="rounded-[24px] border border-[#dbe3ed] bg-white p-4 shadow-[0_16px_36px_rgba(20,31,48,0.06)] md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[11px] font-black uppercase tracking-[0.16em] text-[#66758a]">Controls</p>
              <h2 className="mt-1 mb-0 text-[21px] font-extrabold text-[#172033]">Find, filter, and post without shrinking the feed</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ControlTabButton isActive={activePanel === "find"} label="Find" onClick={() => setActivePanel("find")} />
              <ControlTabButton isActive={activePanel === "new"} label="New Post" onClick={() => setActivePanel("new")} />
              <ControlTabButton isActive={activePanel === "people"} label="Top Contributors" onClick={() => setActivePanel("people")} />
            </div>
          </div>

          {activePanel === "find" ? (
            <div className="mt-4 grid gap-4">
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
            <div className="mt-4">
              <CommunityComposer
                documents={documents}
                draft={draft}
                isAuthenticated={isAuthenticated}
                isSubmitting={isSubmitting}
                sessions={sessions}
                setDraft={setDraft}
                subjects={communityData.subjects}
                submitError={submitError}
                onSubmit={handleSubmit}
              />
            </div>
          ) : null}

          {activePanel === "people" ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        </section>

        <section className="grid gap-4">
          {isLoading ? (
            <>
              {[0, 1, 2].map((item) => (
                <div className="h-[220px] rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" key={item} />
              ))}
            </>
          ) : visibleFeed.length ? (
            visibleFeed.map((post) => (
              <CommunityFeedCard
                canVote={isAuthenticated}
                key={post.id}
                onVote={handleVote}
                post={post}
              />
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[#c7d2e2] bg-white px-6 py-10 text-center">
              <h2 className="m-0 text-2xl font-extrabold text-[#172033]">Nothing here yet</h2>
              <p className="mt-3 mb-0 text-sm text-[#66758a]">Change a filter or publish the first thread for this study space.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
