import { useCallback, useEffect } from "react";
import { useUploadDocModal } from "../contexts/UploadDocContext.jsx";

export default function useUploadDoc({ onUploaded } = {}) {
  const { openUpload, registerPageRefresh } = useUploadDocModal();

  useEffect(() => {
    if (!onUploaded) return undefined;
    return registerPageRefresh(onUploaded);
  }, [onUploaded, registerPageRefresh]);

  const open = useCallback(() => {
    openUpload();
  }, [openUpload]);

  return { open };
}
