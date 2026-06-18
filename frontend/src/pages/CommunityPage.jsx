import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import CommunityFeedRow from "../components/community/CommunityFeedRow.jsx";
import CommunityPageShell from "../components/community/CommunityPageShell.jsx";
import { buildCommunityPanelSearch, normalizeCommunityPanel } from "../components/community/communityPanelUtils.js";
import { normalizeThreadPost } from "../components/community/communityThreadViewModel.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import useCommunityRealtime from "../hooks/useCommunityRealtime.js";
import { getCommunityHome } from "../services/communityApi.js";

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

const DEFAULT_SORT = "latest";
const DEFAULT_TYPE = "all";

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
  const [communityData, setCommunityData] = useState({ feed: [], subjects: [], topContributors: [] });
  const [visibleLimit, setVisibleLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
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
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (requestedPanel !== "new") return;
    navigate(`/community/new${buildLegacyComposerSearch(searchParams)}`, { replace: true });
  }, [navigate, requestedPanel, searchParams]);

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
    setVisibleLimit(20);
  }, [filterState.sort, filterState.type, filterState.subject, deferredSearch]);

  const loadCommunity = useCallback(async ({ showLoading = true } = {}) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;

    if (showLoading) {
      setIsLoading(true);
    }

    setError("");

    try {
      const data = await getCommunityHome({
        tab: filterState.sort,
        postType: filterState.type === DEFAULT_TYPE ? undefined : filterState.type,
        subject: filterState.subject || undefined,
        search: deferredSearch || undefined,
        limit: visibleLimit + 1,
      });

      if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;

      const rawFeed = Array.isArray(data.feed) ? data.feed : [];
      if (rawFeed.length > visibleLimit) {
        setHasMore(true);
        setCommunityData({
          feed: rawFeed.slice(0, visibleLimit),
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          topContributors: Array.isArray(data.topContributors) ? data.topContributors : [],
        });
      } else {
        setHasMore(false);
        setCommunityData({
          feed: rawFeed,
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          topContributors: Array.isArray(data.topContributors) ? data.topContributors : [],
        });
      }
    } catch (err) {
      if (!isMountedRef.current || latestLoadIdRef.current !== loadId) return;
      setError(err.response?.data?.error || "Could not load community posts.");
    } finally {
      if (isMountedRef.current && latestLoadIdRef.current === loadId) {
        setIsLoading(false);
      }
    }
  }, [deferredSearch, filterState.sort, filterState.subject, filterState.type, visibleLimit]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  useCommunityRealtime({
    channelKey: "community-feed-live",
    enabled: true,
    getDebounceMs: (payload) => {
      const eventType = payload?.new?.event_type;
      if (eventType === "post_vote_changed" || eventType === "reply_vote_changed") {
        return 80;
      }
      return 250;
    },
    onSignal: () => {
      loadCommunity({ showLoading: false });
    },
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
                <button className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2f7] px-3 py-2 text-xs font-extrabold text-[#42526a] hover:bg-[#e2e8f0] transition" onClick={clearFilters} type="button">
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

        {activePanel === "people" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {communityData.topContributors.map((person, index) => (
              <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[20px] bg-[#f7f9fb] px-4 py-4" key={person.id}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#172033] text-sm font-black text-white">{index + 1}</span>
                <div>
                  <strong className="block text-sm text-[#172033]">{person.displayName}</strong>
                  <span className="text-xs text-[#66758a]">
                    {person.displayName
                      ? `@${person.displayName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`
                      : (person.email ? `@${person.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "")}` : "@student")}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-[#4648d4]">{person.score} pts</span>
              </div>
            ))}
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

      {hasMore && !isLoading ? (
        <div className="mt-4 flex justify-center">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#dbe3ed] bg-white px-8 text-sm font-extrabold text-[#172033] hover:border-[#172033] hover:bg-slate-50 transition"
            onClick={() => setVisibleLimit((prev) => prev + 20)}
            type="button"
          >
            Load More Posts
          </button>
        </div>
      ) : null}
    </CommunityPageShell>
  );
}
