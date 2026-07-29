import { useCallback } from "react";
import { translate } from "../lib/i18n.js";
import { usePreferences } from "../contexts/PreferencesContext.jsx";

export default function useTranslation() {
  let language = "en-US";
  try {
    const prefs = usePreferences();
    if (prefs?.language) {
      language = prefs.language;
    }
  } catch {
    // Fallback gracefully to default language if rendered outside PreferencesProvider
  }

  const t = useCallback(
    (key, vars) => translate(language, key, vars),
    [language]
  );

  return { t, language };
}
