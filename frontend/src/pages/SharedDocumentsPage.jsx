import React, { useEffect, useState } from "react";
import { getSharedDocumentDownload, listSharedDocuments, saveSharedDocumentToLibrary } from "../services/chatApi.js";

export default function SharedDocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listSharedDocuments().then((payload) => setDocuments(payload.documents || [])).catch((err) => setError(err.response?.data?.error || "Could not load shared documents"));
  }, []);

  async function download(document) {
    setBusyId(document.id);
    try {
      const result = await getSharedDocumentDownload(document.id);
      window.location.assign(result.signedUrl);
    } catch (requestError) { setError(requestError.response?.data?.error || "Download failed"); }
    finally { setBusyId(null); }
  }

  async function save(document) {
    setBusyId(document.id);
    try { await saveSharedDocumentToLibrary(document.id); }
    catch (requestError) { setError(requestError.response?.data?.error || "Save failed"); }
    finally { setBusyId(null); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Shared Documents</h1>
        <p className="text-sm text-slate-500">These files do not count toward storage until saved to My Documents.</p>
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={document.id}>
              <strong className="block truncate text-sm text-slate-900">{document.title}</strong>
              <span className="mt-1 block text-xs text-slate-500">{document.cloud_files?.mime_type || "Document"}</span>
              <div className="mt-3 flex gap-2">
                <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold" disabled={busyId === document.id} onClick={() => download(document)} type="button">Download</button>
                <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white" disabled={busyId === document.id} onClick={() => save(document)} type="button">Save to My Documents</button>
              </div>
            </article>
          ))}
          {!documents.length && !error ? <p className="text-sm text-slate-500">No shared documents yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
