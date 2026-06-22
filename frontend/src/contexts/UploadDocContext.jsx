import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import UploadDocModal from "../pages/UploadDocModal.jsx";
import { listSubjects } from "../services/subjectApi.js";
import { useToast } from "./ToastContext.jsx";

const UploadDocContext = createContext(null);

export function useUploadDocModal() {
  const context = useContext(UploadDocContext);
  if (!context) {
    throw new Error("useUploadDocModal must be used within UploadDocProvider");
  }
  return context;
}

export function UploadDocProvider({ children }) {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const pageRefreshRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    listSubjects()
      .then((items) => {
        if (isMounted) setSubjects(items);
      })
      .catch(() => {
        if (isMounted) setSubjects([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("upload") !== "true") return;

    setIsOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("upload");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openUpload = useCallback(() => {
    setIsOpen(true);
  }, []);

  const registerPageRefresh = useCallback((callback) => {
    if (typeof callback !== "function") return () => {};
    pageRefreshRef.current.add(callback);
    return () => {
      pageRefreshRef.current.delete(callback);
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSuccess = useCallback(
    (result) => {
      addToast({
        type: "success",
        title: "Document uploaded successfully",
        message: "Your study set is ready to use.",
      });

      if (result.document?.extraction_status === "pending") {
        addToast({
          type: "info",
          title: "Processing document",
          message: `AI is analyzing "${result.document.title}"...`,
        });
      }

      pageRefreshRef.current.forEach((callback) => {
        callback(result);
      });
      setIsOpen(false);
    },
    [addToast]
  );

  const handleError = useCallback(
    (message) => {
      addToast({
        type: "error",
        title: "Upload failed",
        message,
      });
    },
    [addToast]
  );

  const value = { openUpload, registerPageRefresh };

  return (
    <UploadDocContext.Provider value={value}>
      {children}
      <UploadDocModal
        isOpen={isOpen}
        subjects={subjects}
        onClose={handleClose}
        onError={handleError}
        onSuccess={handleSuccess}
      />
    </UploadDocContext.Provider>
  );
}
