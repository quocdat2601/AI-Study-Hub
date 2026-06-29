import React, { useEffect, useMemo, useState } from "react";
import { createChatSnapshot, getChatShareOptions, updateSharedLinkAccess } from "../../services/chatApi.js";
import { XIcon } from "./WorkspaceIcons.jsx";

export default function ChatShareModal({ sessionId, onClose }) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState(null);
  const [links, setLinks] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let active = true;
    getChatShareOptions(sessionId).then((payload) => {
      if (!active) return;
      setOptions(payload.documents || []);
      setLinks(payload.links || []);
      setSelected(new Set((payload.documents || []).filter((item) => item.isPrimary).map((item) => item.id)));
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.error || "Could not load sharing options");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [sessionId]);

  const excludedCited = useMemo(
    () => options.filter((item) => item.citationCount > 0 && !selected.has(item.id)),
    [options, selected]
  );

  function toggle(document) {
    if (document.required || !document.eligible) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(document.id)) next.delete(document.id);
      else next.add(document.id);
      return next;
    });
    setAcknowledged(false);
  }

  async function createShare() {
    if (excludedCited.length && !acknowledged) return;
    setIsCreating(true);
    setError("");
    try {
      const payload = await createChatSnapshot(sessionId, {
        includedDocumentIds: [...selected],
        acknowledgedExcludedCitationDocumentIds: excludedCited.map((item) => item.id),
      });
      setResult({ ...payload, url: `${window.location.origin}${payload.path}` });
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not create immutable share");
    } finally {
      setIsCreating(false);
    }
  }

  async function changeAccess(link, access) {
    setError("");
    try {
      const updated = await updateSharedLinkAccess(link.id, access);
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, ...updated } : item));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not update link access");
    }
  }

  const latestLink = links[0];
  const latestUrl = latestLink?.shareUrl ? `${window.location.origin}${latestLink.shareUrl}` : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-2xl" aria-modal="true" role="dialog">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-base font-bold text-slate-900">Share immutable chat</h3>
            <p className="mt-1 text-xs text-slate-500">This link captures the current messages and selected files for 30 days.</p>
          </div>
          <button aria-label="Close share dialog" className="text-slate-400 hover:text-slate-700" onClick={onClose} type="button"><XIcon size={17} /></button>
        </div>

        {isLoading ? <div className="mt-4 h-28 animate-pulse rounded-md bg-slate-100" /> : null}
        {!isLoading && latestLink ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2"><p className="m-0 text-xs font-bold text-slate-800">Current snapshot</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${latestLink.status === "Shared" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{latestLink.status}</span></div>
            <p className="mb-2 mt-1 text-[11px] text-slate-500">Expires {new Date(latestLink.expiresAt).toLocaleString()}</p>
            {latestUrl ? <div className="flex gap-2"><input className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 text-xs" readOnly value={latestUrl} /><button className="rounded-md border border-slate-200 bg-white px-2 text-xs font-bold" onClick={() => navigator.clipboard.writeText(latestUrl)} type="button">Copy</button></div> : <p className="text-xs text-slate-500">This legacy link cannot be copied. Create a fresh snapshot to get a new URL.</p>}
            <div className="mt-2 flex gap-2"><button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold" onClick={() => changeAccess(latestLink, latestLink.isEnabled ? "restricted" : "shared")} type="button">Make {latestLink.isEnabled ? "restricted" : "shared"}</button><button className="rounded-md text-xs font-bold text-indigo-600" onClick={() => setLinks([])} type="button">Create new version</button></div>
          </div>
        ) : null}
        {!isLoading && !result && !latestLink ? (
          <div className="mt-4 grid gap-2">
            {options.map((document) => (
              <label className={`flex items-start gap-2 rounded-md border p-2.5 ${document.eligible ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"}`} key={document.id}>
                <input checked={selected.has(document.id)} disabled={document.required || !document.eligible} onChange={() => toggle(document)} type="checkbox" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-800">{document.title}</span>
                  <span className="block text-[10px] text-slate-500">
                    {document.required ? "Primary document - always included" : document.ineligibleReason || `${document.citationCount} citation${document.citationCount === 1 ? "" : "s"}`}
                  </span>
                </span>
              </label>
            ))}
            {excludedCited.length ? (
              <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
                <span>Some copied messages cite excluded files. Their citation cards will be omitted.</span>
              </label>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="m-0 text-xs font-bold text-emerald-800">Snapshot ready</p>
            <div className="mt-2 flex gap-2">
              <input className="min-w-0 flex-1 rounded border border-emerald-200 bg-white px-2 text-xs" readOnly value={result.url} />
              <button className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white" onClick={() => navigator.clipboard.writeText(result.url)} type="button">Copy</button>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-md bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p> : null}
        {!isLoading && !result ? (
          <div className="mt-4 flex justify-end gap-2">
            <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" onClick={onClose} type="button">Cancel</button>
            <button className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={isCreating || (excludedCited.length > 0 && !acknowledged)} onClick={createShare} type="button">{isCreating ? "Creating..." : "Create link"}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
