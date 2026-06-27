import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getPublicChatSnapshot, getSnapshotDocumentDownload, importChatSnapshot, registerSharedSnapshotOpen } from "../services/chatApi.js";
import { cacheDocumentChat, cacheWorkspaceState } from "../utils/workspaceCache.js";

const POST_LOGIN_REDIRECT_KEY = "aiStudyHub.postLoginRedirect";

function rememberReturnPath(location) {
  const returnPath = `${location.pathname}${location.search || ""}${location.hash || ""}`;
  try {
    window.sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, returnPath);
  } catch {
    // Session storage can be unavailable in restricted browser modes.
  }
}

export default function SharedChatSnapshotPage() {
  const { token } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicChatSnapshot(token).then((data) => {
      if (active) setPayload(data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.status === 410 ? "This shared link has expired or was disabled." : "This shared chat is unavailable.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !payload || error) return;
    registerSharedSnapshotOpen(token).catch(() => {
      // A recipient-history failure must not block the immutable public preview.
    });
  }, [token, isAuthenticated, payload, error]);

  async function importSnapshot() {
    if (!isAuthenticated) {
      rememberReturnPath(location);
      navigate("/login", { state: { from: location } });
      return;
    }

    setIsImporting(true);
    setError("");
    try {
      const result = await importChatSnapshot(token);
      const primaryDocumentId = result.session?.primaryDocumentId;
      cacheDocumentChat(primaryDocumentId, { sessionId: result.session?.id, messages: result.messages || [] });
      cacheWorkspaceState({ selectedId: primaryDocumentId });
      navigate('/workspace');
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not import this chat.");
    } finally {
      setIsImporting(false);
    }
  }

  async function downloadDocument(document) {
    if (!isAuthenticated) {
      rememberReturnPath(location);
      navigate("/login", { state: { from: location } });
      return;
    }

    try {
      const result = await getSnapshotDocumentDownload(token, document.id);
      window.location.assign(result.signedUrl);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not download this file.");
    }
  }

  if (isLoading) return <main className="grid min-h-[70vh] place-items-center bg-slate-50 text-sm text-slate-500">Loading immutable chat...</main>;
  if (!payload) return <main className="grid min-h-[70vh] place-items-center bg-slate-50 px-6 text-center text-sm font-semibold text-red-700">{error}</main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-200 pb-5">
          <p className="m-0 text-xs font-bold uppercase text-indigo-600">Immutable shared chat</p>
          <h1 className="mt-1 text-2xl font-bold">{payload.snapshot.title}</h1>
          <p className="m-0 text-sm text-slate-500">Available until {new Date(payload.snapshot.expiresAt).toLocaleString()}</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={isImporting} onClick={importSnapshot} type="button">
              {isAuthenticated ? (isImporting ? "Importing..." : "Import and continue") : "Sign in to import"}
            </button>
          </div>
        </header>

        <section className="py-5">
          <h2 className="text-sm font-bold">Included documents</h2>
          <div className="flex flex-wrap gap-2">
            {payload.documents.map((document) => (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold" key={document.id}>
                <span>{document.title}{document.isPrimary ? " (primary)" : ""}</span>
                <button className="text-indigo-600 hover:underline" onClick={() => downloadDocument(document)} type="button">
                  {isAuthenticated ? "Download" : "Sign in to download"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 pb-10">
          {payload.messages.map((message) => (
            <article className={`max-w-[85%] rounded-lg px-4 py-3 ${message.role === "user" ? "ml-auto bg-indigo-600 text-white" : "bg-white shadow-sm"}`} key={message.id}>
              <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              {message.sources?.length ? (
                <details className="mt-2 text-xs opacity-80">
                  <summary className="cursor-pointer font-bold">Sources ({message.sources.length})</summary>
                  {message.sources.map((source) => <p className="mb-0 mt-1" key={`${source.documentId}-${source.chunkId}`}>{source.documentTitle}{source.pageStart ? ` - Page ${source.pageStart}` : ""}</p>)}
                </details>
              ) : null}
            </article>
          ))}
        </section>
        {error ? <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white">{error}</p> : null}
      </div>
    </main>
  );
}
