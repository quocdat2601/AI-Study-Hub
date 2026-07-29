import React, { useEffect, useRef, useState } from "react";
import {
  UPLOAD_DOC_ACCEPT_ATTR,
  UPLOAD_DOC_MAX_SIZE_MB,
  getUploadDocFileLabel,
  isUploadDocTimeoutError,
  uploadDocument,
  validateUploadDocFile,
} from "../services/uploadDocApi.js";
import { formatFileSize } from "../lib/formatFileSize.js";
import { searchTags } from "../services/onboardingApi.js";
import useTranslation from "../hooks/useTranslation.js";

function VisibilityOption({ active, disabled, label, description, onClick, tone }) {
  const activeClass = tone === "public"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_8px_22px_rgba(16,185,129,0.16)] dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
    : "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-[0_8px_22px_rgba(99,102,241,0.16)] dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200";
  const inactiveClass = "border-[#dbe3ed] bg-white text-[#344154] hover:border-[#b8c3d6] hover:bg-[#f8faff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500";
  const dotClass = tone === "public"
    ? active ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-800"
    : active ? "bg-[#4648d4]" : "bg-indigo-200 dark:bg-indigo-800";

  return (
    <button
      aria-pressed={active}
      className={`flex min-h-[58px] flex-1 items-start gap-2 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? activeClass : inactiveClass}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className={`mt-1 h-3 w-3 flex-none rounded-full ${dotClass}`} />
      <span>
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-relaxed opacity-75">{description}</span>
      </span>
    </button>
  );
}

export default function UploadDocModal({ isOpen, subjects, onClose, onSuccess, onError }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [tags, setTags] = useState("");
  const [tagMatches, setTagMatches] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setFile(null);
    setTitle("");
    setSubjectId("");
    setTags("");
    setTagMatches([]);
    setIsPublic(false);
    setProgress(0);
    setIsUploading(false);
    setIsProcessing(false);
    setError("");
    abortRef.current = null;
  }

  function handleClose() {
    if (isUploading) return;
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen]);

  // Gợi ý tag đã có theo đoạn đang gõ (sau dấu phẩy cuối), debounce
  useEffect(() => {
    const term = tags.split(",").pop().trim().toLowerCase();
    if (!term) {
      setTagMatches([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const chosen = new Set(
          tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
        );
        const results = await searchTags(term, 6);
        setTagMatches(results.filter((tag) => !chosen.has(tag.name)));
      } catch {
        setTagMatches([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [tags]);

  function applyTagSuggestion(name) {
    const idx = tags.lastIndexOf(",");
    const prefix = idx >= 0 ? `${tags.slice(0, idx + 1)} ` : "";
    setTags(`${prefix}${name}, `);
    setTagMatches([]);
  }

  function pickFile(nextFile) {
    const validationError = validateUploadDocFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setFile(nextFile);

    if (!title.trim()) {
      setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) pickFile(dropped);
  }

  function handleProgress(value) {
    setProgress(value);
    if (value >= 100) setIsProcessing(true);
  }

  async function handleUpload() {
    if (!file || isUploading) return;

    setError("");
    setIsUploading(true);
    setIsProcessing(false);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploadDocument({
        file,
        title: title.trim() || file.name,
        subjectId: subjectId || undefined,
        tags: tags.trim() || undefined,
        isPublic,
        onProgress: handleProgress,
        signal: controller.signal,
      });

      resetForm();
      onSuccess(result);
      onClose();
    } catch (err) {
      if (err.code === "ERR_CANCELED") {
        setError(t("upload.cancelUpload"));
      } else if (isUploadDocTimeoutError(err)) {
        const message = t("upload.processingSub");
        setError(message);
        onError?.(message);
      } else {
        const message = err.response?.data?.error || t("common.error");
        setError(message);
        onError?.(message);
      }
      setProgress(0);
      setIsProcessing(false);
    } finally {
      setIsUploading(false);
      abortRef.current = null;
    }
  }

  function handleCancelUpload() {
    abortRef.current?.abort();
    setIsUploading(false);
    setIsProcessing(false);
    setProgress(0);
  }

  const progressLabel = isProcessing
    ? t("upload.processingLabel")
    : t("upload.uploadingLabel");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px] dark:bg-black/60">
      <div
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-doc-title"
      >
        <header className="bg-gradient-to-r from-[#4648d4] to-[#5b5ef0] px-5 py-3.5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-wide text-white/80">{t("upload.badge")}</p>
              <h2 id="upload-doc-title" className="m-0 mt-0.5 text-lg font-bold">
                {t("upload.title")}
              </h2>
              <p className="m-0 mt-0.5 text-sm text-white/85">
                {t("upload.subtitle", { maxMB: UPLOAD_DOC_MAX_SIZE_MB })}
              </p>
            </div>
            <button
              className="border-0 bg-white/15 text-xl leading-none text-white cursor-pointer rounded-lg h-9 w-9 disabled:opacity-40 hover:bg-white/25 transition-colors"
              onClick={handleClose}
              disabled={isUploading}
              type="button"
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!file ? (
            <button
              className="group flex w-full cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-[#c7d2fe] bg-[#f8faff] px-5 py-7 text-center transition hover:border-[#4648d4] hover:bg-[#f3f5ff] dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-indigo-500 dark:hover:bg-slate-800"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              type="button"
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4648d4] text-2xl text-white shadow-[0_10px_24px_rgba(70,72,212,0.35)] transition group-hover:scale-105">
                ↑
              </span>
              <strong className="text-[#172033] dark:text-slate-100">{t("upload.dropzoneTitle")}</strong>
              <span className="mt-1 text-sm text-[#66758a] dark:text-slate-400">{t("upload.dropzoneSub")}</span>
            </button>
          ) : (
            <div className="rounded-2xl border border-[#e5e9ef] bg-[#fafbff] p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fee2e2] text-xs font-black text-[#ef4444]">
                  {getUploadDocFileLabel(file)}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-[#172033] dark:text-slate-100">{file.name}</strong>
                  <span className="text-xs text-[#66758a] dark:text-slate-400">{formatFileSize(file.size)}</span>
                </div>
                {!isUploading ? (
                  <button
                    className="rounded-lg border border-[#e5e9ef] bg-white px-2.5 py-1.5 text-xs font-bold text-[#66758a] cursor-pointer hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    onClick={() => setFile(null)}
                    type="button"
                  >
                    {t("upload.removeFile")}
                  </button>
                ) : null}
              </div>

              {isUploading ? (
                <div className="mt-4 rounded-xl bg-white p-3 dark:bg-slate-900">
                  <div className="mb-2 flex justify-between text-xs font-bold text-[#66758a] dark:text-slate-400">
                    <span>{progressLabel}</span>
                    <span>{isProcessing ? "..." : `${progress}%`}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#e6e8ea] dark:bg-slate-700">
                    {isProcessing ? (
                      <span className="block h-full w-full animate-pulse rounded-full bg-gradient-to-r from-[#4648d4] via-[#7c7ef8] to-[#4648d4]" />
                    ) : (
                      <span
                        className="block h-full rounded-full bg-[#4648d4] transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </div>
                  {isProcessing ? (
                    <p className="m-0 mt-2 text-xs text-[#66758a]">
                      {t("upload.processingSub")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <input
            ref={inputRef}
            accept={UPLOAD_DOC_ACCEPT_ATTR}
            className="hidden"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) pickFile(picked);
              event.target.value = "";
            }}
            type="file"
          />

          <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label htmlFor="upload-doc-title" className="text-sm font-bold text-[#344154] dark:text-slate-300">
                {t("upload.docTitleLabel")}
              </label>
              <input
                id="upload-doc-title"
                className="w-full rounded-xl border border-[#dbe3ed] bg-white px-3 py-2 text-sm font-normal text-[#172033] outline-none focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={isUploading}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("upload.docTitlePlaceholder")}
                value={title}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor="upload-doc-subject" className="text-sm font-bold text-[#344154] dark:text-slate-300">
                  {t("upload.subjectLabel")}
                </label>
                <select
                  id="upload-doc-subject"
                  className="w-full rounded-xl border border-[#dbe3ed] bg-white px-3 py-2 text-sm font-normal text-[#172033] outline-none focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={isUploading}
                  onChange={(event) => setSubjectId(event.target.value)}
                  value={subjectId}
                >
                  <option value="">{t("upload.subjectSelect")}</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <label htmlFor="upload-doc-tags" className="text-sm font-bold text-[#344154] dark:text-slate-300">
                  {t("upload.tagsLabel")}
                </label>
                <div className="relative w-full">
                  <input
                    id="upload-doc-tags"
                    className="w-full rounded-xl border border-[#dbe3ed] bg-white px-3 py-2 text-sm font-normal text-[#172033] outline-none focus:border-[#4648d4] focus:ring-2 focus:ring-[#4648d4]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    disabled={isUploading}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder={t("upload.tagsPlaceholder")}
                    value={tags}
                  />
                  {tagMatches.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {tagMatches.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyTagSuggestion(tag.name)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-normal text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <span>{tag.name}</span>
                            <span className="text-xs text-slate-400">{t("upload.tagsDocCount", { count: tag.doc_count })}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e9ef] bg-[#fafbff] p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-sm font-black text-[#344154] dark:text-slate-200">{t("upload.visibilityTitle")}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${isPublic ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-indigo-100 text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300"}`}>
                    {isPublic ? t("upload.visibilityPublic") : t("upload.visibilityPrivate")}
                  </span>
                </div>
                <p className="m-0 mt-1 text-xs leading-snug text-[#66758a] dark:text-slate-400">
                  {t("upload.visibilityDesc")}
                </p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label={t("upload.visibilityTitle")}>
                <VisibilityOption
                  active={!isPublic}
                  description={t("upload.privateDesc")}
                  disabled={isUploading}
                  label={t("upload.visibilityPrivate")}
                  onClick={() => setIsPublic(false)}
                  tone="private"
                />
                <VisibilityOption
                  active={isPublic}
                  description={t("upload.publicDesc")}
                  disabled={isUploading}
                  label={t("upload.visibilityPublic")}
                  onClick={() => setIsPublic(true)}
                  tone="public"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50/90 to-red-50/90 p-3.5 text-rose-950 shadow-sm dark:border-rose-900/60 dark:from-rose-950/40 dark:to-red-950/30 dark:text-rose-200">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  {t("upload.errorTitle")}
                </h4>
                <p className="mt-0.5 text-sm font-medium leading-relaxed">
                  {error}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setError("")}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-200/60 hover:text-rose-700 dark:hover:bg-rose-900/60 dark:hover:text-rose-200 transition-colors"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-3 border-t border-[#e5e9ef] bg-[#fafbff] px-5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          {isUploading ? (
            <button
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm font-bold text-[#344154] cursor-pointer hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={handleCancelUpload}
              type="button"
            >
              {t("upload.cancelUpload")}
            </button>
          ) : (
            <button
              className="rounded-xl border border-[#dbe3ed] bg-white px-4 py-2.5 text-sm font-bold text-[#344154] cursor-pointer hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={handleClose}
              type="button"
            >
              {t("upload.cancel")}
            </button>
          )}

          <button
            className="inline-flex items-center gap-2 rounded-xl border-0 bg-[#4648d4] px-5 py-2.5 text-sm font-bold text-white cursor-pointer shadow-[0_8px_20px_rgba(70,72,212,0.28)] hover:bg-[#3b3dbf] active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!file || isUploading}
            onClick={handleUpload}
            type="button"
          >
            {isUploading ? t("upload.pleaseWait") : t("upload.submit")}
          </button>
        </footer>
      </div>
    </div>
  );
}
