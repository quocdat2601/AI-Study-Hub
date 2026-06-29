import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const THEME_KEY = "ash-theme";
const LANGUAGE_KEY = "ash-language";

const PreferencesContext = createContext(null);

function readStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) || "en-US";
  } catch {
    return "en-US";
  }
}

function applyThemeToDocument(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(readStoredTheme);
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Ignore storage errors.
    }
  }, [language]);

  useEffect(() => {
    if (!user) return;
    if (user.theme) setThemeState(user.theme === "dark" ? "dark" : "light");
    if (user.language) setLanguageState(user.language);
  }, [user]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme === "dark" ? "dark" : "light");
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(nextLanguage || "en-US");
  }, []);

  const value = useMemo(
    () => ({ theme, language, setTheme, setLanguage }),
    [theme, language, setTheme, setLanguage]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}
