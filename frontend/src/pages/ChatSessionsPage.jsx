import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createChatSession,
  deleteChatSession,
  listChatSessions,
} from "../services/chatApi.js";

function getDocumentCount(session) {
  return session.chat_session_documents?.length || 0;
}

export default function ChatSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadSessions() {
    setIsLoading(true);
    setError("");
    try {
      const data = await listChatSessions();
      setSessions(data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load chat sessions");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      const session = await createChatSession(title || "New chat");
      navigate(`/chat/${session.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create chat session");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(sessionId) {
    setError("");
    try {
      await deleteChatSession(sessionId);
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete chat session");
    }
  }

  return (
    <main className="page chat-home">
      <section className="section-header">
        <div>
          <p className="eyebrow">AI Chat</p>
          <h1>Study with multiple documents</h1>
          <p className="muted">Create a chat, attach up to 5 readable documents, and ask follow-up questions.</p>
        </div>
      </section>

      <form className="chat-create" onSubmit={handleCreate}>
        <input
          aria-label="Chat title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Chat title"
          value={title}
        />
        <button className="button button--primary" disabled={isCreating} type="submit">
          {isCreating ? "Creating..." : "New chat"}
        </button>
      </form>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {isLoading ? (
        <p className="muted">Loading chats...</p>
      ) : sessions.length ? (
        <div className="session-list">
          {sessions.map((session) => (
            <article className="session-card" key={session.id}>
              <div>
                <h2>{session.title}</h2>
                <p className="muted">
                  {getDocumentCount(session)} / 5 documents · Last active{" "}
                  {new Date(session.last_activity_at || session.created_at).toLocaleString()}
                </p>
              </div>
              <div className="row-actions">
                <Link className="button button--secondary" to={`/chat/${session.id}`}>
                  Open
                </Link>
                <button className="link-button link-button--danger" onClick={() => handleDelete(session.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No chats yet. Create one to start studying.</p>
      )}
    </main>
  );
}
