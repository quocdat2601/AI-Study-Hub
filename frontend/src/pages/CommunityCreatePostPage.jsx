import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CommunityBanner from "../components/community/CommunityBanner.jsx";
import CommunityComposer from "../components/community/CommunityComposer.jsx";
import CommunityLoginPromptModal from "../components/community/CommunityLoginPromptModal.jsx";
import CommunityPageShell from "../components/community/CommunityPageShell.jsx";
import { normalizeComposeType, validateDraft, mapServerErrorsToFields } from "../components/community/communityComposerUtils.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { listChatSessions } from "../services/chatApi.js";
import {
  createCommunityPost,
  getCommunityHome,
} from "../services/communityApi.js";
import { listDocuments } from "../services/documentApi.js";

function buildComposerRouteSearch(draft) {
  const params = new URLSearchParams();
  params.set("compose", normalizeComposeType(draft?.postType) || "discussion");

  if (normalizeComposeType(draft?.postType) === "document_share" && draft?.documentId) {
    params.set("documentId", draft.documentId);
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}

export default function CommunityCreatePostPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const composeSearchParam = normalizeComposeType(searchParams.get("compose"));
  const [subjects, setSubjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
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
  const loginTarget = useMemo(() => ({
    pathname: location.pathname,
    search: buildComposerRouteSearch(draft),
  }), [draft, location.pathname]);

  useEffect(() => {
    let isMounted = true;

    async function loadComposerContext() {
      setIsLoading(true);
      setError("");

      try {
        const [communityData, documentData, sessionData] = await Promise.all([
          getCommunityHome({ limit: 1 }),
          isAuthenticated ? listDocuments() : Promise.resolve([]),
          isAuthenticated ? listChatSessions() : Promise.resolve([]),
        ]);

        if (!isMounted) return;
        setSubjects(Array.isArray(communityData.subjects) ? communityData.subjects : []);
        setDocuments(Array.isArray(documentData) ? documentData : []);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.error || "Could not load the community composer.");
        setSubjects([]);
        setDocuments([]);
        setSessions([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadComposerContext();
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
    const subjectSearchParam = searchParams.get("subject");
    if (!subjects.length || !subjectSearchParam) return;
    const matchedSubject = subjects.find(
      (s) => s.code?.toLowerCase() === subjectSearchParam.toLowerCase()
    );
    if (matchedSubject) {
      setDraft((current) => {
        if (current.subjectIds.length) return current;
        return {
          ...current,
          subjectIds: [String(matchedSubject.id)],
        };
      });
    }
  }, [subjects, searchParams]);

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
    if (draft.postType !== "document_share" || !draft.documentId) return;

    const matchingDocument = documents.find((doc) => String(doc.id) === String(draft.documentId));
    const nextSubjectId = matchingDocument?.subject_id || matchingDocument?.subjects?.id;
    if (!nextSubjectId) return;

    setDraft((current) => ({
      ...current,
      subjectIds: [String(nextSubjectId)],
    }));
  }, [documents, draft.documentId, draft.postType]);

  useEffect(() => {
    if (draft.postType !== "ai_study_log" || !draft.chatSessionId) return;

    const matchingSession = sessions.find((item) => String(item.session.id) === String(draft.chatSessionId));
    if (!matchingSession) return;

    const suggestedSubjectIds = (matchingSession.documents || [])
      .map((document) => document.subjectId || document.subject_id || document.subject?.id || document.subjects?.id)
      .filter(Boolean)
      .map((value) => String(value));

    if (!suggestedSubjectIds.length) return;

    setDraft((current) => ({
      ...current,
      subjectIds: suggestedSubjectIds,
    }));
  }, [draft.chatSessionId, draft.postType, sessions]);

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

  const navItems = [
    { id: "find", label: "Find", to: "/community" },
    { id: "new", label: "New Post", isActive: true, to: `/community/new${buildComposerRouteSearch(draft)}` },
    { id: "people", label: "Top Contributors", to: "/community?panel=people" },
  ];

  return (
    <CommunityPageShell
      isAuthenticated={isAuthenticated}
    >
      <CommunityLoginPromptModal
        isOpen={isLoginPromptOpen}
        loginTarget={loginTarget}
        onClose={() => setIsLoginPromptOpen(false)}
      />

      <CommunityBanner
        title="Create a community post"
        description="Start a discussion, ask a question, or publish a document or AI study log on its own dedicated page."
        navItems={navItems}
        LinkComponent={Link}
      />

      {error ? (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-5 py-4 text-sm font-bold text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-[420px] rounded-[24px] border border-[#dbe3ed] bg-white animate-pulse" />
      ) : (
        <CommunityComposer
          documents={documents}
          draft={draft}
          isAuthenticated={isAuthenticated}
          isSubmitting={isSubmitting}
          onRequireAuth={() => setIsLoginPromptOpen(true)}
          sessions={sessions}
          setDraft={setDraft}
          showPreview={false}
          subjects={subjects}
          submitError={submitError}
          validationErrors={validationErrors}
          onSubmit={handleSubmit}
        />
      )}
    </CommunityPageShell>
  );
}
