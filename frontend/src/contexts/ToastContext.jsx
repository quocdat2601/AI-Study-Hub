import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import ToastContainer from "../components/ToastContainer.jsx";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = ++toastId;
    setToasts((current) => [...current, { id, ...toast }]);

    if (toast.type !== "progress") {
      window.setTimeout(() => removeToast(id), toast.duration || 5000);
    }

    return id;
  }, [removeToast]);

  const updateToast = useCallback((id, patch) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast))
    );
  }, []);

  const value = useMemo(
    () => ({ addToast, updateToast, removeToast }),
    [addToast, updateToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
