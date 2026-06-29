import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "../services/documentApi.js";

const DOCUMENTS_CACHE_PREFIX = "aiStudyHub.documents.";

function getCacheKey({ search, subjectId }) {
  return `${DOCUMENTS_CACHE_PREFIX}${JSON.stringify({
    search: search || "",
    subjectId: subjectId || "",
  })}`;
}

function readCachedDocuments(key) {
  try {
    const cached = window.sessionStorage.getItem(key);
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    return Array.isArray(parsed?.documents) ? parsed.documents : [];
  } catch {
    return [];
  }
}

function writeCachedDocuments(key, documents) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({
      documents,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // Session storage can be unavailable in restricted browsers.
  }
}

export default function useDocuments(params = {}) {
  const { search, subjectId } = params;
  const cacheKey = getCacheKey({ search, subjectId });
  const [documents, setDocuments] = useState(() => readCachedDocuments(cacheKey));
  const [isLoading, setIsLoading] = useState(() => !readCachedDocuments(cacheKey).length);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async ({ useCache = true } = {}) => {
    const cached = useCache ? readCachedDocuments(cacheKey) : [];
    if (cached.length) {
      setDocuments(cached);
      setIsLoading(false);
    } else {
      setIsLoading((current) => documents.length ? current : true);
    }
    setError("");

    try {
      const nextDocuments = await listDocuments({ search, subjectId });
      setDocuments(nextDocuments);
      writeCachedDocuments(cacheKey, nextDocuments);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load documents");
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, documents.length, search, subjectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    setDocuments,
    isLoading,
    error,
    setError,
    reload: () => loadDocuments({ useCache: false }),
  };
}
