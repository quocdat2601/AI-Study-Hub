import React, { useEffect, useState } from "react";
import { updateDocument } from "../services/documentApi.js";
import { tagsToInput } from "../lib/formatTags.js";

export default function EditDocumentModal({ document, subjects, isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!document) return;
    setTitle(document.title || "");
    setSubjectId(document.subject_id ? String(document.subject_id) : "");
    setTags(tagsToInput(document.tags));
    setError("");
  }, [document, isOpen]);

  if (!isOpen || !document) return null;

  async function handleSave() {
    if (!title.trim()) {
      setError("Title cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const result = await updateDocument(document.id, {
        title: title.trim(),
        subjectId: subjectId ? Number(subjectId) : null,
        tags: tags.trim(),
      });
      onSuccess(result.document);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update document.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/45 p-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
        <h2 className="m-0 text-xl font-bold text-[#172033]">Edit Document</h2>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-[#344154]">
            Title
            <input
              className="rounded-lg border border-[#dbe3ed] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4648d4]"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#344154]">
            Subject
            <select
              className="rounded-lg border border-[#dbe3ed] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4648d4]"
              onChange={(event) => setSubjectId(event.target.value)}
              value={subjectId}
            >
              <option value="">No subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#344154]">
            Tags
            <input
              className="rounded-lg border border-[#dbe3ed] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#4648d4]"
              onChange={(event) => setTags(event.target.value)}
              placeholder="e.g. algorithms, midterm"
              value={tags}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg bg-[#fff0f0] px-3 py-2 text-sm font-bold text-[#b42318]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm font-bold cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg border-0 bg-[#4648d4] px-4 py-2.5 text-sm font-bold text-white cursor-pointer disabled:opacity-50"
            disabled={isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
