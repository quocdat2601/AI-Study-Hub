import React, { useState } from "react";
import { SUPPORTED_LANGUAGES } from "../lib/i18n.js";
import useTranslation from "../hooks/useTranslation.js";

export default function AccountLanguageModal({ currentLanguage, onClose, onSave }) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState(currentLanguage || "en-US");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      await onSave({ language });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update language.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onSubmit={handleSubmit}
      >
        <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">{t("account.language")}</h2>
        <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">{t("account.selectLanguageDesc")}</p>

        <div className="mt-5 grid gap-2">
          {SUPPORTED_LANGUAGES.map((option) => (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                language === option.value
                  ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
              key={option.value}
            >
              <input
                checked={language === option.value}
                name="language"
                onChange={() => setLanguage(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{option.label}</span>
            </label>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
            type="button"
          >
            {t("common.cancel")}
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
