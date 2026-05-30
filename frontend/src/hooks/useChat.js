import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDocumentToSession,
  getChatMessages,
  getChatSession,
  removeDocumentFromSession,
  sendChatMessage,
  updateChatSession,
} from "../services/chatApi.js";
import { listDocuments } from "../services/documentApi.js";

export default function useChat(sessionId) {
  const scrollRef = useRef(null);
  const [session, setSession] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const loadChat = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [sessionData, messageData, documentData] = await Promise.all([
        getChatSession(sessionId),
        getChatMessages(sessionId),
        listDocuments(),
      ]);
      setSession(sessionData);
      setTitle(sessionData.title || "New chat");
      setMessages(messageData);
      setDocuments(documentData || []);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load chat");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function renameChat(nextTitle = title) {
    setError("");
    const updated = await updateChatSession(sessionId, nextTitle);
    setSession(updated);
    setTitle(updated.title);
    return updated;
  }

  async function addDocument(docId) {
    setError("");
    await addDocumentToSession(sessionId, Number(docId));
    setSession(await getChatSession(sessionId));
  }

  async function removeDocument(docId) {
    setError("");
    await removeDocumentFromSession(sessionId, docId);
    setSession(await getChatSession(sessionId));
  }

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || isSending) return null;

    const optimisticMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((current) => [...current, optimisticMessage]);
    setIsSending(true);
    setError("");

    try {
      const response = await sendChatMessage(sessionId, content);
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessage.id),
        response.userMessage,
        response.assistantMessage,
      ]);
      setSession(await getChatSession(sessionId));
      return response;
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return {
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
    reload: loadChat,
    renameChat,
    addDocument,
    removeDocument,
    sendMessage,
  };
}
