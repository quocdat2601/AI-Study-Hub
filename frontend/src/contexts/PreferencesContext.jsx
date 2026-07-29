import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const LANGUAGE_KEY = "ash-language";

const PreferencesContext = createContext(null);

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) || "en-US";
  } catch {
    return "en-US";
  }
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Ignore storage errors.
    }
  }, [language]);

  useEffect(() => {
    if (!user) return;
    if (user.language) setLanguageState(user.language);
  }, [user]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(nextLanguage || "en-US");
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}
