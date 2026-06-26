import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disableSharedLink, listSharedChats, listSharedLinks } from "../services/chatApi.js";
import { cacheDocumentChat, cacheWorkspaceState } from "../utils/workspaceCache.js";

export default function SharedChatsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [links, setLinks] = useState([]);
  const [error, setError] = useState("");
  const [renderedAt] = useState(() => Date.now());
  useEffect(() => {
    Promise.all([listSharedChats(), listSharedLinks()])
      .then(([chatPayload, linkPayload]) => {
        setItems(chatPayload.sharedChats || []);
        setLinks(linkPayload.links || []);
      })
      .catch((err) => setError(err.response?.data?.error || "Could not load shared chats"));
  }, []);

  async function disable(link) {
    try {
      await disableSharedLink(link.id);
      setLinks((current) => current.map((item) => (
        item.id === link.id ? { ...item, disabled_at: new Date().toISOString() } : item
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not disable this link");
    }
  }

  function openChat(item) {
    const session = item.chat_sessions;
    cacheDocumentChat(session.primary_document_id, { sessionId: session.id });
    cacheWorkspaceState({ selectedId: session.primary_document_id });
    navigate('/workspace');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Shared Chats</h1>
        <p className="text-sm text-slate-500">Independent chats imported from immutable links.</p>
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <button className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-indigo-300" key={item.id} onClick={() => openChat(item)} type="button">
              <strong className="block text-sm text-slate-900">{item.chat_snapshots?.title || "Shared chat"}</strong>
              <span className="mt-1 block text-xs text-slate-500">Imported {new Date(item.created_at).toLocaleDateString()}</span>
            </button>
          ))}
          {!items.length && !error ? <p className="text-sm text-slate-500">No imported chats yet.</p> : null}
        </div>
        <section className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-bold text-slate-900">My shared links</h2>
          <div className="grid gap-2">
            {links.map((link) => {
              const unavailable = Boolean(link.disabled_at) || new Date(link.expires_at).getTime() <= renderedAt;
              return (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3" key={link.id}>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{link.chat_snapshots?.title || "Shared chat"}</strong>
                    <span className="text-xs text-slate-500">{unavailable ? "Disabled or expired" : `Expires ${new Date(link.expires_at).toLocaleString()}`}</span>
                  </div>
                  {!unavailable ? <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600" onClick={() => disable(link)} type="button">Disable</button> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
