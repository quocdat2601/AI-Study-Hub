import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import {
  getSharedDocumentDownload,
  listSharedLinks,
  listReceivedSharedLinks,
  listSharedDocuments,
  removeReceivedSharedLink,
  saveSharedDocumentToLibrary,
  updateSharedLinkAccess,
} from "../services/chatApi.js";

function mimeLabel(mimeType) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("wordprocessingml")) return "DOCX";
  return "FILE";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DocumentThumbnail({ document }) {
  if (document.thumbnailUrl) {
    return (
      <div className="h-16 w-16 flex-none overflow-hidden rounded-xl border border-[#e5e9ef] bg-slate-50 shadow-sm">
        <img alt="" className="h-full w-full object-contain p-1" src={document.thumbnailUrl} />
      </div>
    );
  }
  return (
    <span className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-[#fee2e2] text-xs font-black text-[#ef4444]">
      {mimeLabel(document.cloud_files?.mime_type)}
    </span>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((item) => (
        <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" key={item} />
      ))}
    </div>
  );
}

export default function SharedPage() {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "links" ? "links" : "documents";
  const linkScope = searchParams.get("scope") === "received" ? "received" : "mine";
  const [documents, setDocuments] = useState([]);
  const [links, setLinks] = useState([]);
  const [receivedLinks, setReceivedLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const loadShared = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [documentsPayload, linksPayload, receivedPayload] = await Promise.all([
        listSharedDocuments(),
        listSharedLinks(),
        listReceivedSharedLinks(),
      ]);
      setDocuments(documentsPayload.documents || []);
      setLinks(linksPayload.links || []);
      setReceivedLinks(receivedPayload.links || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not load shared items.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadShared(); }, [loadShared]);

  function setTab(tab) {
    setSearchParams(tab === "links" ? { tab, scope: linkScope } : { tab });
  }

  function setLinkScope(scope) { setSearchParams({ tab: "links", scope }); }

  async function downloadDocument(document) {
    const action = `download:${document.id}`;
    setBusyAction(action);
    try {
      const { signedUrl } = await getSharedDocumentDownload(document.id);
      const link = window.document.createElement("a");
      link.href = signedUrl;
      link.download = document.title || "document";
      link.click();
      addToast({ type: "success", title: "Download started", message: document.title });
    } catch (requestError) {
      const message = requestError.response?.data?.error || "Could not download document.";
      setError(message);
      addToast({ type: "error", title: "Download failed", message });
    } finally {
      setBusyAction("");
    }
  }

  async function saveDocument(document) {
    const action = `save:${document.id}`;
    setBusyAction(action);
    try {
      const result = await saveSharedDocumentToLibrary(document.id);
      setDocuments((current) => current.map((item) => (
        item.id === document.id
          ? { ...item, savedDocumentId: result.document?.id || item.savedDocumentId, thumbnailUrl: result.document?.thumbnailUrl || item.thumbnailUrl }
          : item
      )));
      addToast({
        type: "success",
        title: result.reused ? "Already saved" : "Saved to My Documents",
        message: result.sessionUpdated ? "Your imported chat remains connected to this document." : document.title,
      });
    } catch (requestError) {
      const message = requestError.response?.data?.error || "Could not save document.";
      setError(message);
      addToast({ type: "error", title: "Save failed", message });
    } finally {
      setBusyAction("");
    }
  }

  async function changeLinkAccess(link, access) {
    const action = `access:${link.id}`;
    setBusyAction(action);
    try {
      const updated = await updateSharedLinkAccess(link.id, access);
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, ...updated } : item));
      addToast({ type: "success", title: access === "shared" ? "Link is shared" : "Link is restricted", message: link.title });
    } catch (requestError) {
      const message = requestError.response?.data?.error || "Could not update link access.";
      setError(message);
      addToast({ type: "error", title: "Link update failed", message });
    } finally { setBusyAction(""); }
  }

  async function removeReceivedLink(link) {
    const action = `remove:${link.recipientId}`;
    setBusyAction(action);
    try {
      await removeReceivedSharedLink(link.recipientId);
      setReceivedLinks((current) => current.filter((item) => item.recipientId !== link.recipientId));
      addToast({ type: "success", title: "Removed from Shared with me", message: link.title });
    } catch (requestError) {
      const message = requestError.response?.data?.error || "Could not remove received link.";
      setError(message);
      addToast({ type: "error", title: "Remove failed", message });
    } finally { setBusyAction(""); }
  }

  function openSnapshot(link) {
    if (!link.shareUrl) {
      addToast({ type: "error", title: "Link unavailable", message: "Create a new snapshot version to get a share URL." });
      return;
    }
    window.open(link.shareUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-[1280px]">
        <section className="mb-6 rounded-2xl bg-gradient-to-r from-[#4648d4] to-[#6366f1] p-6 text-white shadow-[0_12px_30px_rgba(70,72,212,0.22)] md:p-8">
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-white/75">Shared</p>
          <h1 className="m-0 mt-2 text-3xl font-bold">Shared with you</h1>
          <p className="m-0 mt-2 max-w-2xl text-sm text-white/90">Imported conversations and their documents stay together until you decide to save a copy to your study library.</p>
        </section>

        <div className="mb-5 inline-flex rounded-xl border border-[#dbe3ed] bg-white p-1 shadow-sm">
          {[['documents', 'Documents'], ['links', 'Shared links']].map(([tab, label]) => (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-[#4648d4] text-white shadow-sm" : "text-[#66758a] hover:bg-slate-50"}`}
              key={tab}
              onClick={() => setTab(tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#b42318]"><span>{error}</span><button className="text-xs underline" onClick={loadShared} type="button">Try again</button></div> : null}

        {isLoading ? <LoadingCards /> : activeTab === "documents" ? (
          documents.length ? (
            <div className="grid gap-4">
              {documents.map((document) => {
                const saving = busyAction === `save:${document.id}`;
                const downloading = busyAction === `download:${document.id}`;
                const saved = Boolean(document.savedDocumentId);
                return (
                  <article className="rounded-2xl border border-[#e5e9ef] bg-white p-5 shadow-sm" key={document.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <DocumentThumbnail document={document} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h2 className="m-0 truncate text-base font-bold text-[#172033]">{document.title}</h2><span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">Imported</span></div>
                          <p className="m-0 mt-1 text-sm text-[#66758a]">{mimeLabel(document.cloud_files?.mime_type)} · {document.subjects?.name || "No subject"} · Imported {formatDate(document.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg border border-[#dbe3ed] bg-white px-3 py-1.5 text-xs font-bold text-[#4648d4] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-60" disabled={Boolean(busyAction)} onClick={() => downloadDocument(document)} type="button">{downloading ? "Downloading..." : "Download"}</button>
                        <button className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${saved ? "bg-emerald-50 text-emerald-700" : "bg-[#4648d4] text-white hover:bg-[#383ac4]"}`} disabled={Boolean(busyAction) || saved} onClick={() => saveDocument(document)} type="button">{saving ? "Saving..." : saved ? "Saved to My Documents" : "Save to My Documents"}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EmptyState title="No imported documents yet" message="Documents from chats you import will appear here." />
        ) : (
          <>
            <div className="mb-3 flex gap-1 border-b border-[#e5e9ef]">
              {[['mine', 'My links'], ['received', 'Shared with me']].map(([scope, label]) => <button className={`border-b-2 px-3 py-2 text-xs font-bold ${linkScope === scope ? "border-[#4648d4] text-[#4648d4]" : "border-transparent text-[#66758a]"}`} key={scope} onClick={() => setLinkScope(scope)} type="button">{label}</button>)}
            </div>
            {(linkScope === "mine" ? links : receivedLinks).length ? (
            <div className="grid gap-2">
              {(linkScope === "mine" ? links : receivedLinks).map((link) => {
                const isBusy = busyAction === `access:${link.id}`;
                const badgeClass = link.status === "Shared" ? "bg-emerald-50 text-emerald-700" : link.status === "Expired" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
                return (
                  <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e9ef] bg-white px-4 py-3 shadow-sm transition hover:border-indigo-200" key={link.id}>
                    <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="m-0 truncate text-sm font-bold text-[#172033]">{link.title}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>{link.status}</span></div><p className="m-0 mt-1 truncate text-xs text-[#66758a]">{linkScope === "mine" ? `Created ${formatDate(link.createdAt)}` : `Received ${formatDate(link.firstOpenedAt)}`} · Expires {formatDate(link.expiresAt)} · {link.documentCount} docs · {link.messageCount} messages</p></div>
                    <div className="flex flex-wrap gap-2"><button className="rounded-md bg-[#4648d4] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60" disabled={!link.shareUrl || link.status !== "Shared"} onClick={() => openSnapshot(link)} type="button">Open</button>{linkScope === "mine" && link.shareUrl ? <button className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-1.5 text-xs font-bold text-[#4648d4]" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${link.shareUrl}`)} type="button">Copy</button> : null}{linkScope === "mine" && link.status !== "Expired" ? <button className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-1.5 text-xs font-bold text-[#344154] disabled:opacity-60" disabled={isBusy} onClick={() => changeLinkAccess(link, link.isEnabled ? "restricted" : "shared")} type="button">{isBusy ? "Saving..." : link.isEnabled ? "Restrict" : "Share"}</button> : null}{linkScope === "received" ? <button className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-1.5 text-xs font-bold text-[#66758a]" disabled={busyAction === `remove:${link.recipientId}`} onClick={() => removeReceivedLink(link)} type="button">Remove</button> : null}</div>
                  </article>
                );
              })}
            </div>
            ) : <EmptyState title={linkScope === "mine" ? "You have not created any shared chat links yet" : "Nothing has been shared with you yet"} message={linkScope === "mine" ? "Create an immutable snapshot from a chat when you want to share it." : "Opened shared snapshots will appear here."} />}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function EmptyState({ title, message }) {
  return <div className="rounded-2xl border border-dashed border-[#c7d2fe] bg-white px-6 py-16 text-center"><h2 className="m-0 text-lg font-bold text-[#172033]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#66758a]">{message}</p></div>;
}
