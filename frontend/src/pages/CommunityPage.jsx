import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import CommunityFeedRow from "../components/community/CommunityFeedRow.jsx";
import CommunityPageShell from "../components/community/CommunityPageShell.jsx";
import { buildCommunityPanelSearch, normalizeCommunityPanel } from "../components/community/communityPanelUtils.js";
import { normalizeThreadPost } from "../components/community/communityThreadViewModel.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import useCommunityRealtime from "../hooks/useCommunityRealtime.js";
import { getCommunityHome, getCommunityFeed } from "../services/communityApi.js";
import { cx } from "../components/community/communityUtils.js";

function SearchIcon() {
  return (
    <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FilterPill({ isActive, children, onClick }) {
  return (
    <button
      className={isActive
        ? "rounded-full bg-[#4648d4] px-4 py-1.5 text-xs font-bold text-white transition-colors"
        : "rounded-full bg-[#f0ece4] px-4 py-1.5 text-xs font-semibold text-[#6b6660] transition-all hover:bg-[#e8e4dc] hover:text-[#1a1a2e]"}
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
        ? "border-0 border-b-2 border-[#4648d4] bg-transparent px-1 pb-2 text-sm font-bold text-[#4648d4]"
        : "border-0 border-b-2 border-transparent bg-transparent px-1 pb-2 text-sm font-medium text-[#6b6660] hover:border-[#c9c4b8] hover:text-[#1a1a2e] transition-colors"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

const DEFAULT_SORT = "latest";
const DEFAULT_TYPE = "all";
const PAGE_SIZE = 15;

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  const left = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-sm font-bold text-[#6b6660] transition hover:border-[#4648d4] hover:text-[#4648d4] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        type="button"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="inline-flex h-9 w-9 items-center justify-center text-sm text-[#6b6660]">…</span>
        ) : (
          <button
            key={p}
            className={p === page
              ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#4648d4] text-sm font-bold text-white shadow-sm"
              : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-sm font-bold text-[#6b6660] transition hover:border-[#4648d4] hover:text-[#4648d4]"}
            onClick={() => onPageChange(p)}
            type="button"
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e4dc] bg-white text-sm font-bold text-[#6b6660] transition hover:border-[#4648d4] hover:text-[#4648d4] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        type="button"
      >
        ›
      </button>
    </nav>
  );
}

function getPanelBannerContent(panel) {
  if (panel === "people") {
    return {
      title: "Top contributors",
      description: "See who is consistently helping classmates, sharing useful resources, and keeping the study space moving.",
    };
  }

  return {
    title: "New discussions",
    description: "Track active study threads, tighten the feed with filters, and jump into the right discussion quickly.",
  };
}

function buildLegacyComposerSearch(searchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("panel");
  const search = params.toString();
  return search ? `?${search}` : "";
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPanel = normalizeCommunityPanel(searchParams.get("panel"), "find");
  const activePanel = requestedPanel === "new" ? "find" : requestedPanel;
  const [communityData, setCommunityData] = useState({ feed: [], subjects: [], topContributors: [], total: 0, totalPages: 1 });
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);
  const latestLoadIdRef = useRef(0);
  const [filterState, setFilterState] = useState({
    search: "",
    type: DEFAULT_TYPE,
    subject: code || null,
    sort: DEFAULT_SORT,
  });
  const deferredSearch = useDeferredValue(filterState.search);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (requestedPanel !== "new") return;
    navigate(`/community/new${buildLegacyComposerSearch(searchParams)}`, { replace: true });
  }, [navigate, requestedPanel, searchParams]);

  useEffect(() => {
    setFilterState((current) => ({ ...current, subject: code || null }));
  }, [code]);

  useEffect(() => {
    if (!["all", "question"].includes(filterState.type) && ["unanswered", "solved"].includes(filterState.sort)) {
      setFilterState((current) => ({ ...current, sort: DEFAULT_SORT }));
    }
  }, [filterState.type, filterState.sort]);

  useEffect(() => {
    setPage(1);
  }, [filterState.sort, filterState.type, filterState.subject, deferredSearch]);

  useEffect(() => {
    setHasLoadedMetadata(false);
  }, [isAuthenticated]);

  const loadCommunity = useCallback(async ({ showLoading = true } = {}) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;

    if (showLoading) setIsLoading(true);
    setError("");

    try {
      if (!hasLoadedMetadata) {
        const data = await getCommunityHome({
          tab: filterState.sort,
          postType: filterState.type === DEFAULT_TYPE ? undefined : filterState.type,
          subject: filterState.subject || undefined,
          search: deferredSearch || undefined,
          page,
          pageSize: PAGE_SIZE,
        });

        if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;

        setCommunityData({
          feed: Array.isArray(data.feed) ? data.feed : [],
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          topContributors: Array.isArray(data.topContributors) ? data.topContributors : [],
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        });
        setHasLoadedMetadata(true);
      } else {
        const data = await getCommunityFeed({
          tab: filterState.sort,
          postType: filterState.type === DEFAULT_TYPE ? undefined : filterState.type,
          subject: filterState.subject || undefined,
          search: deferredSearch || undefined,
          page,
          pageSize: PAGE_SIZE,
        });

        if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;

        setCommunityData((current) => ({
          ...current,
          feed: Array.isArray(data.posts) ? data.posts : [],
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        }));
      }
    } catch (err) {
      if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;
      setError(err.response?.data?.error || "Could not load community posts.");
    } finally {
      if (isMountedRef.current && latestLoadIdRef.current === loadId) setIsLoading(false);
    }
  }, [deferredSearch, filterState.sort, filterState.subject, filterState.type, page, hasLoadedMetadata]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  useCommunityRealtime({
    channelKey: "community-feed-live",
    enabled: true,
    getDebounceMs: (payload) => {
      const eventType = payload?.new?.event_type;
      if (eventType === "post_vote_changed" || eventType === "reply_vote_changed") return 80;
      return 250;
    },
    onSignal: () => { loadCommunity({ showLoading: false }); },
  });

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

  const canUseQuestionStateSort = filterState.type === "all" || filterState.type === "question";
  const hasActiveFilterContext = Boolean(
    filterState.search.trim()
    || filterState.subject
    || filterState.type !== DEFAULT_TYPE
    || filterState.sort !== DEFAULT_SORT
  );
  const bannerContent = getPanelBannerContent(activePanel);
  const bannerNavItems = [
    { id: "find", label: "Find", isActive: activePanel === "find", to: `${getCommunityPath()}${buildCommunityPanelSearch({ panel: "find" })}` },
    { id: "new", label: "New Post", to: filterState.subject ? `/community/new?compose=discussion&subject=${filterState.subject}` : "/community/new?compose=discussion" },
    { id: "people", label: "Top Contributors", isActive: activePanel === "people", to: `${getCommunityPath()}${buildCommunityPanelSearch({ panel: "people" })}` },
  ];

  return (
    <CommunityPageShell
      isAuthenticated={isAuthenticated}
    >
      <CommunityBanner
        title={bannerContent.title}
        description={bannerContent.description}
        navItems={bannerNavItems}
        LinkComponent={Link}
      >
        {activePanel === "find" ? (
          <div className="grid gap-4">
            <label className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8c857e]">
                <SearchIcon />
              </span>
              <input
                className="w-full rounded-xl border border-[#e4e0d8] bg-[#faf8f5] py-2.5 pl-11 pr-4 text-sm font-medium text-[#1a1a2e] outline-none transition placeholder:text-[#8c857e] focus:border-[#4648d4] focus:bg-white focus:shadow-[0_0_0_3px_rgba(70,72,212,0.12)]"
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
                <button className="inline-flex items-center gap-1.5 rounded-full bg-[#f0ece4] px-3 py-1.5 text-xs font-bold text-[#6b6660] hover:bg-[#e8e4dc] hover:text-[#1a1a2e] transition" onClick={clearFilters} type="button">
                  <svg className="h-3 w-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
                  <span className="rounded-full bg-[#ede9fe] px-3 py-1.5 text-xs font-bold text-[#4648d4]">
                    Subject: {filterState.subject}
                  </span>
                ) : null}
                {filterState.search.trim() ? (
                  <span className="rounded-full bg-[#f0ece4] px-3 py-1.5 text-xs font-bold text-[#6b6660]">
                    Search: {filterState.search.trim()}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {communityData.subjects.map((subject) => (
                <button
                  className={filterState.subject === subject.code
                    ? "rounded-full bg-[#ede9fe] border border-transparent px-3 py-1.5 text-xs font-bold text-[#4648d4]"
                    : "rounded-full bg-[#f0ece4] border border-transparent px-3 py-1.5 text-xs font-semibold text-[#6b6660] hover:bg-[#e8e4dc] hover:text-[#1a1a2e] transition-all"}
                  key={subject.id}
                  onClick={() => setSubjectFilter(subject.code)}
                  type="button"
                >
                  {subject.code} <span className="text-[#8c857e] font-normal">({subject.postCount})</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activePanel === "people" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {communityData.topContributors.map((person, index) => {
              let rankBg = "bg-[#faf8f5] text-[#6b6660] border border-[#e8e4dc]";
              if (index === 0) rankBg = "bg-[radial-gradient(circle_at_top,#fbbf24,#f59e0b)] text-white shadow-sm shadow-amber-500/10";
              else if (index === 1) rankBg = "bg-[radial-gradient(circle_at_top,#d1d5db,#9ca3af)] text-white shadow-sm";
              else if (index === 2) rankBg = "bg-[radial-gradient(circle_at_top,#b45309,#78350f)] text-white shadow-sm";

              return (
                <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border border-[#e4e0d8] bg-[#faf8f5] px-4 py-4 transition hover:translate-y-[-2px] hover:shadow-md hover:border-[#c9c4b8]" key={person.id}>
                  <span className={cx("flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold", rankBg)}>{index + 1}</span>
                  <div>
                    <strong className="block text-sm font-bold text-[#1a1a2e]">{person.displayName}</strong>
                    <span className="text-xs text-[#8c857e]">
                      {person.displayName
                        ? `@${person.displayName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`
                        : (person.email ? `@${person.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "")}` : "@student")}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#4648d4] bg-[#ede9fe] px-2.5 py-1 rounded">{person.score} pts</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </CommunityBanner>

      {error ? <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">{error}</div> : null}

      {!isAuthenticated ? (
        <div className="rounded-[24px] border border-[#dbe3ed] bg-gradient-to-br from-[#f8fafc] to-white p-6 shadow-sm text-center md:text-left md:flex md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-[#172033]">Join the Study Hub Community</h3>
            <p className="text-sm text-[#66758a]">Sign in to ask questions, share helpful documents, save study sessions, and earn reputation points.</p>
          </div>
          <Link
            className="mt-4 md:mt-0 inline-flex min-h-10 items-center justify-center rounded-full bg-[#172033] px-6 text-sm font-extrabold text-white no-underline hover:bg-[#2c3e50] transition whitespace-nowrap"
            to="/login"
          >
            Sign In to Participate
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4">
        {isLoading ? (
          <>
            {[0, 1, 2].map((item) => (
              <div className="h-[140px] rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" key={item} />
            ))}
          </>
        ) : communityData.feed.length ? (
          communityData.feed.map((post) => (
            <CommunityFeedRow
              key={post.id}
              variant="light"
              LinkComponent={Link}
              showExcerpt={false}
              thread={normalizeThreadPost({
                ...post,
                href: `/community/posts/${post.id}`,
                lastActivity: {
                  ...post.lastActivity,
                  href: post.lastActivity?.replyId
                    ? `/community/posts/${post.id}#community-reply-${post.lastActivity.replyId}`
                    : `/community/posts/${post.id}`,
                },
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

      {!isLoading && communityData.totalPages > 1 ? (
        <div className="flex flex-col items-center gap-2">
          <Pagination
            page={page}
            totalPages={communityData.totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <p className="text-xs text-[#66758a]">
            Page {page} of {communityData.totalPages} · {communityData.total} post{communityData.total !== 1 ? "s" : ""}
          </p>
        </div>
      ) : null}
    </CommunityPageShell>
  );
}
