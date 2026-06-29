import { useEffect, useRef, useState } from "react";
import { detachChatDocument, getChatSessionMessages, reprocessChatDocument, uploadChatDocument } from "../services/chatApi.js";
import { validateUploadDocFile } from "../services/uploadDocApi.js";

function fingerprint(file) {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function useChatAttachmentQueue({ enabled, sessionId, activeCount, maxDocuments, onPayload, onError }) {
  const [items, setItems] = useState([]);
  const [isClearingPending, setIsClearingPending] = useState(false);
  const itemsRef = useRef(items);
  const activeRef = useRef(null);
  const cancelledIdsRef = useRef(new Set());
  const clearingRef = useRef(false);
  const sessionRef = useRef(sessionId);
  const callbacksRef = useRef({ onPayload, onError, activeCount });

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { callbacksRef.current = { onPayload, onError, activeCount }; }, [activeCount, onError, onPayload]);

  function setQueueItems(updater) {
    setItems((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      itemsRef.current = next;
      return next;
    });
  }

  function updateItem(id, updates) {
    setQueueItems((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  function pumpQueue() {
    if (!enabled || clearingRef.current || activeRef.current || !sessionRef.current) return;
    const item = itemsRef.current.find((candidate) => candidate.status === "queued");
    if (!item) return;

    const activeSessionId = sessionRef.current;
    const controller = new AbortController();
    activeRef.current = { id: item.id, controller };
    updateItem(item.id, { status: "uploading", progress: 0, error: "", retryCategory: null });

    const request = uploadChatDocument(activeSessionId, item.file, {
      signal: controller.signal,
      uploadRequestId: item.uploadRequestId,
      onProgress: (progress) => updateItem(item.id, {
        progress,
        status: progress >= 100 ? "processing" : "uploading",
      }),
    }).then(async (payload) => {
      const processing = payload?.attachmentProcessing;
      const wasCancelled = cancelledIdsRef.current.has(item.id);

      if (wasCancelled && processing?.documentId) {
        try {
          const detachPayload = await detachChatDocument(activeSessionId, processing.documentId);
          callbacksRef.current.onPayload?.(detachPayload, activeSessionId);
        } catch (error) {
          callbacksRef.current.onError?.(error);
        }
        return;
      }

      if (wasCancelled) return;

      callbacksRef.current.onPayload?.(payload, activeSessionId);
      if (processing?.usableForChat) {
        updateItem(item.id, { status: "complete", documentId: processing.documentId, progress: 100 });
        setTimeout(() => {
          setQueueItems((current) => current.filter((candidate) => candidate.id !== item.id));
          pumpQueue();
        }, 450);
      } else {
        updateItem(item.id, {
          status: "failed",
          documentId: processing?.documentId || null,
          error: processing?.processingError || "This file could not be prepared for chat.",
          retryCategory: "processing",
        });
      }
    }).catch((error) => {
      if (cancelledIdsRef.current.has(item.id) || error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError") {
        setQueueItems((current) => current.filter((candidate) => candidate.id !== item.id));
        return;
      }
      updateItem(item.id, {
        status: "failed",
        error: error?.response?.data?.message || error?.response?.data?.error || "Could not upload this file.",
        retryCategory: "upload",
      });
      callbacksRef.current.onError?.(error);
    }).finally(() => {
      cancelledIdsRef.current.delete(item.id);
      if (activeRef.current?.id === item.id) activeRef.current = null;
      pumpQueue();
    });
    activeRef.current.done = request;
  }

  function clearForSessionChange() {
    activeRef.current?.controller.abort();
    activeRef.current = null;
    clearingRef.current = false;
    setIsClearingPending(false);
    cancelledIdsRef.current.clear();
    setQueueItems([]);
  }

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      activeRef.current?.controller.abort();
      activeRef.current = null;
      clearingRef.current = false;
      setIsClearingPending(false);
      cancelledIdsRef.current.clear();
      setQueueItems([]);
      sessionRef.current = sessionId;
    }
  }, [sessionId]);

  useEffect(() => () => {
    activeRef.current?.controller.abort();
    activeRef.current = null;
    clearingRef.current = false;
    cancelledIdsRef.current.clear();
    setQueueItems([]);
  }, []);

  useEffect(() => { pumpQueue(); });

  function enqueue(files) {
    if (!enabled || !sessionId || clearingRef.current) return false;
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
    if (accepted.length) {
      setQueueItems((current) => [...current, ...accepted]);
      pumpQueue();
    }
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
        setQueueItems((current) => current.filter((candidate) => candidate.id !== id));
        pumpQueue();
      } catch (error) {
        updateItem(id, { status: "failed", error: error?.response?.data?.message || error.message, retryCategory: "processing" });
      }
      return;
    }
    updateItem(id, { status: "queued", error: "", retryCategory: null, progress: 0 });
    pumpQueue();
  }

  async function remove(id) {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    cancelledIdsRef.current.add(id);
    if (activeRef.current?.id === id) activeRef.current.controller.abort();
    setQueueItems((current) => current.filter((candidate) => candidate.id !== id));
    if (item.documentId) {
      try {
        const payload = await detachChatDocument(sessionId, item.documentId);
        callbacksRef.current.onPayload?.(payload, sessionId);
      } catch (error) {
        callbacksRef.current.onError?.(error);
      }
    }
    pumpQueue();
  }

  async function clearPending() {
    if (clearingRef.current) return false;
    const currentSessionId = sessionRef.current;
    const pending = itemsRef.current.filter((item) => ["queued", "uploading", "processing", "failed"].includes(item.status));
    if (!pending.length) return false;

    clearingRef.current = true;
    setIsClearingPending(true);
    const activeDone = activeRef.current?.done || null;
    for (const item of pending) {
      cancelledIdsRef.current.add(item.id);
    }
    activeRef.current?.controller.abort();
    setQueueItems((current) => current.filter((item) => !pending.some((candidate) => candidate.id === item.id)));

    const persistedDocumentIds = [...new Set(
      pending
        .map((item) => item.documentId)
        .filter(Boolean)
    )];

    try {
      if (activeDone) {
        await activeDone.catch(() => null);
      }

      for (const documentId of persistedDocumentIds) {
        try {
          const payload = await detachChatDocument(currentSessionId, documentId);
          if (Number(sessionRef.current) === Number(currentSessionId)) {
            callbacksRef.current.onPayload?.(payload, currentSessionId);
          }
        } catch (error) {
          callbacksRef.current.onError?.(error);
        }
      }

      if (Number(sessionRef.current) === Number(currentSessionId)) {
        const payload = await getChatSessionMessages(currentSessionId);
        callbacksRef.current.onPayload?.(payload, currentSessionId);
      }
      return true;
    } catch (error) {
      callbacksRef.current.onError?.(error);
      return false;
    } finally {
      clearingRef.current = false;
      setIsClearingPending(false);
      if (Number(sessionRef.current) === Number(currentSessionId)) {
        pumpQueue();
      }
    }
  }

  return {
    items,
    reservedCount: items.filter((item) => ["queued", "uploading", "processing"].includes(item.status)).length,
    isBlocking: isClearingPending || items.some((item) => ["queued", "uploading", "processing"].includes(item.status)),
    isClearingPending,
    enqueue,
    retry,
    remove,
    clearPending,
    cancelAll: clearForSessionChange,
  };
}
