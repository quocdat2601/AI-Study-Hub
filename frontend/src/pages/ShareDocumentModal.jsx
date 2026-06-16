import React, { useCallback, useEffect, useState } from "react";
import {
  listDocumentShares,
  revokeDocumentShare,
  shareDocument,
  updateDocumentVisibility,
} from "../services/documentApi.js";

export default function ShareDocumentModal({ document, isOpen, onClose, onSuccess }) {
  const documentId = document?.id;
  const documentIsPublic = Boolean(document?.is_public ?? document?.isPublic);
  const [email, setEmail] = useState("");
  const [shares, setShares] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState("");

  const loadShares = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    setError("");

    try {
      setShares(await listDocumentShares(documentId));
    } catch (err) {
      setShares([]);
      setError(err.response?.data?.error || "Could not load shares.");
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!isOpen || !document) return;
    setEmail("");
    setError("");
    setIsPublic(documentIsPublic);
    loadShares();
  }, [document, documentIsPublic, isOpen, loadShares]);

  if (!isOpen || !document) return null;

  async function handleShare() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter the email of the person you want to share with.");
      return;
    }

    setIsSharing(true);
    setError("");

    try {
      await shareDocument(documentId, trimmedEmail);
      setEmail("");
      await loadShares();
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || "Could not share document.");
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRevoke(shareId) {
    setError("");

    try {
      await revokeDocumentShare(documentId, shareId);
      await loadShares();
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || "Could not revoke share.");
    }
  }

  async function handleVisibilityChange(event) {
    const nextIsPublic = event.target.checked;
    setIsUpdatingVisibility(true);
    setError("");

    try {
      const result = await updateDocumentVisibility(documentId, nextIsPublic);
      setIsPublic(Boolean(result.document?.is_public ?? result.document?.isPublic));
      onSuccess?.(result.document);
    } catch (err) {
      setIsPublic(documentIsPublic);
      setError(err.response?.data?.error || "Could not update visibility.");
    } finally {
      setIsUpdatingVisibility(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/45 p-4 dark:bg-black/60">
      <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.2)] dark:border dark:border-slate-700 dark:bg-slate-900">
        <h2 className="m-0 text-xl font-bold text-[#172033] dark:text-slate-100">Share Document</h2>
        <p className="mt-1 text-sm text-[#66758a] dark:text-slate-400">
          Share <strong>{document.title}</strong> with another student by email.
        </p>

        <div className="mt-5 rounded-xl border border-[#e5e9ef] bg-[#fafbff] p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-sm font-bold text-[#344154] dark:text-slate-200">Public visibility</h3>
              <p className="m-0 mt-1 text-xs leading-relaxed text-[#66758a] dark:text-slate-400">
                Public documents can appear on the landing page. Private documents stay visible only to you and people you share with.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#344154] dark:text-slate-200">
              <input
                checked={isPublic}
                className="h-4 w-4 accent-[#4648d4]"
                disabled={isUpdatingVisibility}
                onChange={handleVisibilityChange}
                type="checkbox"
              />
              {isPublic ? "Public" : "Private"}
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="rounded-lg border border-[#dbe3ed] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4648d4] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@example.com"
            type="email"
            value={email}
          />
          <button
            className="rounded-lg border-0 bg-[#4648d4] px-4 py-2.5 text-sm font-bold text-white cursor-pointer disabled:opacity-50"
            disabled={isSharing}
            onClick={handleShare}
            type="button"
          >
            {isSharing ? "Sharing..." : "Share"}
          </button>
        </div>

        <div className="mt-6">
          <h3 className="m-0 text-sm font-bold text-[#344154] dark:text-slate-300">Shared with</h3>

          {isLoading ? (
            <p className="mt-3 text-sm text-[#66758a] dark:text-slate-400">Loading shares...</p>
          ) : shares.length ? (
            <ul className="mt-3 grid gap-2 p-0 list-none">
              {shares.map((share) => (
                <li
                  className="flex items-center justify-between rounded-lg border border-[#e5e9ef] px-3 py-2.5 dark:border-slate-700"
                  key={share.id}
                >
                  <span className="text-sm text-[#172033] dark:text-slate-100">
                    {share.sharedTo?.email || "Unknown user"}
                  </span>
                  <button
                    className="rounded-md border border-[#fecaca] bg-[#fff5f5] px-2.5 py-1.5 text-xs font-bold text-[#b42318] cursor-pointer dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    onClick={() => handleRevoke(share.id)}
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#66758a] dark:text-slate-400">Not shared with anyone yet.</p>
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm font-bold text-[#b42318] dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm font-bold cursor-pointer dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
