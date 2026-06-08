import { useCallback } from "react";
import { translate } from "../lib/i18n.js";
import { usePreferences } from "../contexts/PreferencesContext.jsx";

export default function useTranslation() {
  const { language } = usePreferences();

  const t = useCallback(
    (key, vars) => translate(language, key, vars),
    [language]
  );

  return { t, language };
}
