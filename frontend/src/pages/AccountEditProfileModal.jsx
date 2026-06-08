import React, { useState } from "react";

export default function AccountEditProfileModal({ initialValues, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(initialValues.displayName || "");
  const [handle, setHandle] = useState(initialValues.handle || "");
  const [major, setMajor] = useState(initialValues.major || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      await onSave({
        displayName: displayName.trim(),
        handle: handle.trim().replace(/^@/, ""),
        major: major.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update profile.");
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
        <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">Edit Profile</h2>
        <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">Update your personal details.</p>

        <label className="mt-5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Display name
          <input
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Handle
          <input
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setHandle(event.target.value)}
            placeholder="user1"
            required
            value={handle}
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Major / bio
          <input
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            onChange={(event) => setMajor(event.target.value)}
            placeholder="Student · AI Study Hub"
            value={major}
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
