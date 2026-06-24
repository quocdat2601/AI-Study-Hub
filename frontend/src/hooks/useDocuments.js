import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "../services/documentApi.js";

export default function useDocuments(params = {}) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const { search, subjectId } = params;

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setDocuments(await listDocuments({ search, subjectId }));
    } catch (err) {
      setError(err.response?.data?.error || "Could not load documents");
    } finally {
      setIsLoading(false);
    }
  }, [search, subjectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  return {
    documents,
    setDocuments,
    isLoading,
    error,
    setError,
    reload: loadDocuments,
  };
}
