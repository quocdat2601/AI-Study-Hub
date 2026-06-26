import { useEffect, useRef, useState } from "react";
import { detachChatDocument, reprocessChatDocument, uploadChatDocument } from "../services/chatApi.js";
import { validateUploadDocFile } from "../services/uploadDocApi.js";

function fingerprint(file) {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function useChatAttachmentQueue({ enabled, sessionId, activeCount, maxDocuments, onPayload, onError }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const activeRef = useRef(null);
  const sessionRef = useRef(sessionId);
  const callbacksRef = useRef({ onPayload, onError, activeCount });

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { callbacksRef.current = { onPayload, onError, activeCount }; }, [activeCount, onError, onPayload]);

  function updateItem(id, updates) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  function clearForSessionChange() {
    activeRef.current?.controller.abort();
    activeRef.current = null;
    setItems([]);
  }

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      clearForSessionChange();
      sessionRef.current = sessionId;
    }
  }, [sessionId]);

  useEffect(() => () => clearForSessionChange(), []);

  useEffect(() => {
    if (!enabled || activeRef.current || !sessionId) return;
    const item = items.find((candidate) => candidate.status === "queued");
    if (!item) return;

    const controller = new AbortController();
    activeRef.current = { id: item.id, controller };
    updateItem(item.id, { status: "uploading", progress: 0, error: "", retryCategory: null });

    uploadChatDocument(sessionId, item.file, {
      signal: controller.signal,
      uploadRequestId: item.uploadRequestId,
      onProgress: (progress) => updateItem(item.id, {
        progress,
        status: progress >= 100 ? "processing" : "uploading",
      }),
    }).then((payload) => {
      callbacksRef.current.onPayload?.(payload, sessionId);
      const processing = payload?.attachmentProcessing;
      if (processing?.usableForChat) {
        updateItem(item.id, { status: "complete", documentId: processing.documentId, progress: 100 });
        setTimeout(() => setItems((current) => current.filter((candidate) => candidate.id !== item.id)), 450);
      } else {
        updateItem(item.id, {
          status: "failed",
          documentId: processing?.documentId || null,
          error: processing?.processingError || "This file could not be prepared for chat.",
          retryCategory: "processing",
        });
      }
    }).catch((error) => {
      if (error?.code === "ERR_CANCELED") {
        setItems((current) => current.filter((candidate) => candidate.id !== item.id));
        return;
      }
      updateItem(item.id, {
        status: "failed",
        error: error?.response?.data?.message || error?.response?.data?.error || "Could not upload this file.",
        retryCategory: "upload",
      });
      callbacksRef.current.onError?.(error);
    }).finally(() => {
      if (activeRef.current?.id === item.id) activeRef.current = null;
    });
  }, [enabled, items, sessionId]);

  function enqueue(files) {
    if (!enabled || !sessionId) return false;
    const incoming = Array.from(files || []);
    const reserved = itemsRef.current.filter((item) => ["queued", "uploading", "processing"].includes(item.status)).length;
    const capacity = Math.max(0, maxDocuments - callbacksRef.current.activeCount - reserved);
    const existing = new Set(itemsRef.current.map((item) => item.fingerprint));
    const accepted = [];
    let message = "";

    for (const file of incoming) {
      const validationError = validateUploadDocFile(file);
      const key = fingerprint(file);
      if (validationError) { message = validationError; continue; }
      if (existing.has(key)) { message = "This file is already queued for this chat."; continue; }
      if (accepted.length >= capacity) { message = "This chat can contain at most 20 documents."; break; }
      existing.add(key);
      accepted.push({
        id: newId(),
        file,
        fingerprint: key,
        uploadRequestId: newId(),
        status: "queued",
        progress: 0,
        error: "",
        retryCategory: null,
        documentId: null,
      });
    }
    if (accepted.length) setItems((current) => [...current, ...accepted]);
    if (message) callbacksRef.current.onError?.({ message });
    return accepted.length > 0;
  }

  async function retry(id) {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item || item.status !== "failed") return;
    if (item.retryCategory === "processing" && item.documentId) {
      updateItem(id, { status: "processing", error: "", retryCategory: null });
      try {
        const payload = await reprocessChatDocument(sessionId, item.documentId);
        callbacksRef.current.onPayload?.(payload, sessionId);
        const processing = payload?.attachmentProcessing;
        if (!processing?.usableForChat) throw new Error(processing?.processingError || "This file could not be prepared for chat.");
        setItems((current) => current.filter((candidate) => candidate.id !== id));
      } catch (error) {
        updateItem(id, { status: "failed", error: error?.response?.data?.message || error.message, retryCategory: "processing" });
      }
      return;
    }
    updateItem(id, { status: "queued", error: "", retryCategory: null, progress: 0 });
  }

  async function remove(id) {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    if (activeRef.current?.id === id) activeRef.current.controller.abort();
    setItems((current) => current.filter((candidate) => candidate.id !== id));
    if (item.documentId) {
      try {
        const payload = await detachChatDocument(sessionId, item.documentId);
        callbacksRef.current.onPayload?.(payload, sessionId);
      } catch (error) {
        callbacksRef.current.onError?.(error);
      }
    }
  }

  return {
    items,
    reservedCount: items.filter((item) => ["queued", "uploading", "processing"].includes(item.status)).length,
    isBlocking: items.some((item) => ["queued", "uploading", "processing"].includes(item.status)),
    enqueue,
    retry,
    remove,
    cancelAll: clearForSessionChange,
  };
}
