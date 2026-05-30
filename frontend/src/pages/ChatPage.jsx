import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useChat from "../hooks/useChat.js";

function getAttachedDocuments(session) {
  return (session?.chat_session_documents || [])
    .map((row) => row.documents)
    .filter(Boolean);
}

function formatStatus(status) {
  if (status === "ready") return "Ready";
  if (status === "empty") return "No text";
  if (status === "failed") return "Failed";
  return "Processing";
}

export default function ChatPage() {
  const { sessionId } = useParams();
  const [selectedDocId, setSelectedDocId] = useState("");
  const [content, setContent] = useState("");
  const {
    scrollRef,
    session,
    documents,
    messages,
    title,
    setTitle,
    isLoading,
    isSending,
    error,
    setError,
    renameChat,
    addDocument,
    removeDocument,
    sendMessage,
  } = useChat(sessionId);

  const attachedDocuments = getAttachedDocuments(session);
  const attachedIds = new Set(attachedDocuments.map((doc) => doc.id));
  const canAddDocument = attachedDocuments.length < 5;

  async function handleRename(event) {
    event.preventDefault();
    try {
      await renameChat(title);
    } catch (err) {
      setError(err.response?.data?.error || "Could not rename chat");
    }
  }

  async function handleAddDocument(event) {
    event.preventDefault();
    if (!selectedDocId) return;

    try {
      await addDocument(selectedDocId);
      setSelectedDocId("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not add document");
    }
  }

  async function handleRemoveDocument(docId) {
    try {
      await removeDocument(docId);
    } catch (err) {
      setError(err.response?.data?.error || "Could not remove document");
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = content.trim();
    if (!text || isSending) return;

    setContent("");
    try {
      await sendMessage(text);
    } catch (err) {
      setContent(text);
      setError(err.response?.data?.error || "Could not send message");
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <p className="muted">Loading chat...</p>
      </main>
    );
  }

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar panel">
        <Link className="back-link" to="/chat">
          Back to chats
        </Link>

        <form className="rename-form" onSubmit={handleRename}>
          <label>
            Chat title
            <input onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <button className="button button--secondary" type="submit">
            Save title
          </button>
        </form>

        <section>
          <h2>Attached documents</h2>
          <p className="muted">{attachedDocuments.length} / 5 documents</p>

          <div className="attached-docs">
            {attachedDocuments.map((doc) => (
              <article className="attached-doc" key={doc.id}>
                <div>
                  <strong>{doc.title}</strong>
                  <span>{formatStatus(doc.extraction_status)}</span>
                </div>
                <button className="link-button link-button--danger" onClick={() => handleRemoveDocument(doc.id)} type="button">
                  Remove
                </button>
              </article>
            ))}
          </div>
        </section>

        <form className="attach-form" onSubmit={handleAddDocument}>
          <label>
            Add document
            <select
              disabled={!canAddDocument}
              onChange={(event) => setSelectedDocId(event.target.value)}
              value={selectedDocId}
            >
              <option value="">Choose a document</option>
              {documents.map((doc) => (
                <option
                  disabled={attachedIds.has(doc.id) || doc.extraction_status !== "ready"}
                  key={doc.id}
                  value={doc.id}
                >
                  {doc.title} - {formatStatus(doc.extraction_status)}
                </option>
              ))}
            </select>
          </label>
          <button className="button button--primary" disabled={!selectedDocId || !canAddDocument} type="submit">
            Add
          </button>
        </form>
      </aside>

      <section className="chat-main panel">
        <div className="chat-main__header">
          <div>
            <p className="eyebrow">Multi-document chat</p>
            <h1>{session?.title || "New chat"}</h1>
          </div>
        </div>

        {error ? <div className="alert alert--error">{error}</div> : null}

        <div className="message-list">
          {!attachedDocuments.length ? (
            <div className="empty-chat">Add documents to start chatting.</div>
          ) : null}

          {messages.map((message) => (
            <article className={`message message--${message.role}`} key={message.id}>
              <div className="message__role">{message.role === "assistant" ? "AI" : "You"}</div>
              <div className="message__bubble">{message.content}</div>
            </article>
          ))}

          {isSending ? <div className="message message--assistant message--loading">AI is thinking...</div> : null}
          <div ref={scrollRef} />
        </div>

        <form className="chat-composer" onSubmit={handleSend}>
          <textarea
            disabled={isSending}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Ask about your attached documents..."
            rows={3}
            value={content}
          />
          <button className="button button--primary" disabled={isSending || !content.trim()} type="submit">
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
