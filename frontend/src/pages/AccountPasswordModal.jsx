import React, { useState } from "react";
import useTranslation from "../hooks/useTranslation.js";

export default function AccountPasswordModal({ onClose, onSave }) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError(t("common.error"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("common.error"));
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ newPassword });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t("common.error"));
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
        <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">{t("account.changePassword")}</h2>
        <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">{t("account.changePasswordDesc")}</p>

        <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t("account.newPassword")}
          <input
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t("account.confirmPassword")}
          <input
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>

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
