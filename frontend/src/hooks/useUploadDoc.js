import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../contexts/ToastContext.jsx";

export default function useUploadDoc({ onUploaded } = {}) {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("upload") !== "true") return;

    setIsOpen(true);
    searchParams.delete("upload");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const onSuccess = useCallback(
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

      onUploaded?.(result);
    },
    [addToast, onUploaded]
  );

  const onError = useCallback(
    (message) => {
      addToast({
        type: "error",
        title: "Upload failed",
        message,
      });
    },
    [addToast]
  );

  return { isOpen, open, close, onSuccess, onError };
}
