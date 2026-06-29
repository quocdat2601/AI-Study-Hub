import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addBookmark,
  listBookmarks,
  removeBookmark,
} from "../services/bookmarkApi.js";

function getDocId(bookmark) {
  return bookmark.doc_id || bookmark.documents?.id;
}

export default function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const bookmarkedDocIds = useMemo(() => {
    return new Set(bookmarks.map(getDocId).filter(Boolean));
  }, [bookmarks]);

  const loadBookmarks = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setBookmarks(await listBookmarks());
    } catch (err) {
      setError(err.response?.data?.error || "Could not load bookmarks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  async function toggleBookmark(docId) {
    const wasBookmarked = bookmarkedDocIds.has(docId);
    const previous = bookmarks;

    if (wasBookmarked) {
      setBookmarks((current) => current.filter((bookmark) => getDocId(bookmark) !== docId));
    } else {
      setBookmarks((current) => [
        { id: `pending-${docId}`, doc_id: docId, pending: true },
        ...current,
      ]);
    }

    try {
      if (wasBookmarked) {
        await removeBookmark(docId);
      } else {
        const created = await addBookmark(docId);
        setBookmarks((current) => current.map((bookmark) => (
          bookmark.id === `pending-${docId}` ? created : bookmark
        )));
      }
    } catch (err) {
      setBookmarks(previous);
      throw err;
    }
  }

  return {
    bookmarks,
    bookmarkedDocIds,
    isLoading,
    error,
    setError,
    reload: loadBookmarks,
    toggleBookmark,
  };
}
