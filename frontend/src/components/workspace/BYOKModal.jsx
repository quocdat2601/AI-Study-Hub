import React, { useCallback, useEffect, useRef, useState } from "react";
import { saveApiKey, listApiKeys, deleteApiKey } from "../../services/apiKeyApi.js";

const PROVIDER_PATTERNS = [
  { regex: /^sk-ant-/, provider: "anthropic", label: "Anthropic (Claude)", emoji: "🤖" },
  { regex: /^sk-proj-/, provider: "openai", label: "OpenAI", emoji: "🟢" },
  { regex: /^sk-[^a]/i, provider: "openai", label: "OpenAI", emoji: "🟢" },
  { regex: /^AIza/, provider: "gemini", label: "Google Gemini", emoji: "✨" },
  { regex: /^gsk_/, provider: "groq", label: "Groq", emoji: "⚡" },
  { regex: /^xai-/, provider: "grok", label: "xAI Grok", emoji: "🚀" },
];

function detectProvider(rawKey) {
  if (!rawKey) return null;
  for (const p of PROVIDER_PATTERNS) {
    if (p.regex.test(rawKey.trim())) return p;
  }
  return null;
}

const PROVIDER_COLORS = {
  gemini: "bg-blue-50 text-blue-700 border-blue-200",
  openai: "bg-emerald-50 text-emerald-700 border-emerald-200",
  anthropic: "bg-orange-50 text-orange-700 border-orange-200",
  groq: "bg-amber-50 text-amber-700 border-amber-200",
  grok: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function BYOKModal({ onClose, onKeysChanged }) {
  const [rawKey, setRawKey] = useState("");
  const [detected, setDetected] = useState(null);
  const [savedKeys, setSavedKeys] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [feedback, setFeedback] = useState(null); // { type: "success"|"error"|"warning", message }
  const inputRef = useRef(null);

  const loadKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    try {
      const data = await listApiKeys();
      setSavedKeys(data.keys || []);
    } catch {
      setSavedKeys([]);
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [loadKeys]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleKeyChange(e) {
    const val = e.target.value;
    setRawKey(val);
    setDetected(detectProvider(val));
    setFeedback(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!rawKey.trim() || !detected || isSaving) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const result = await saveApiKey(rawKey.trim());
      setRawKey("");
      setDetected(null);
      await loadKeys();
      onKeysChanged?.();
      setFeedback({
        type: result.warning ? "warning" : "success",
        message: result.message,
      });
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Failed to save key.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(provider) {
    setIsDeleting(provider);
    setFeedback(null);
    try {
      await deleteApiKey(provider);
      setSavedKeys((prev) => prev.filter((k) => k.provider !== provider));
      onKeysChanged?.();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || `Failed to remove ${provider} key.`;
      setFeedback({ type: "error", message });
    } finally {
      setIsDeleting(null);
    }
  }

  const feedbackColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-700",
  };

  const geminiKey = savedKeys.find((k) => k.provider === "gemini");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="text-lg">🔑</span> Bring Your Own Key
              </h2>
              <p className="m-0 mt-0.5 text-[12px] text-slate-500">
                Your key is encrypted with AES-256-GCM before storage.
              </p>
            </div>
            <button
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Gemini active key banner */}
          {geminiKey && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
              <span className="text-base">✨</span>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[12px] font-bold text-blue-700">Active: Google Gemini</p>
                <code className="text-[11px] font-mono text-blue-600">{geminiKey.masked_key}</code>
              </div>
              <span className="text-[10px] font-semibold text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">In use</span>
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSave}>
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-600" htmlFor="byok-key-input">
              Paste API Key
            </label>
            <input
              id="byok-key-input"
              ref={inputRef}
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              disabled={isSaving}
              onChange={handleKeyChange}
              placeholder="AIza... / sk-ant-... / sk-... / xai-..."
              type="password"
              value={rawKey}
            />

            {/* Provider detection badge */}
            <div className="mt-2 h-6 flex items-center">
              {detected ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${PROVIDER_COLORS[detected.provider] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  <span>{detected.emoji}</span>
                  {detected.label} detected
                </span>
              ) : rawKey.trim() ? (
                <span className="text-[12px] text-slate-400">Unknown provider — check key format</span>
              ) : (
                <span className="text-[12px] text-slate-400">Auto-detects provider from key prefix</span>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mt-3 rounded-lg border px-3.5 py-2.5 text-[12px] font-medium leading-relaxed ${feedbackColors[feedback.type]}`}>
                {feedback.message}
              </div>
            )}

            <button
              className="mt-4 w-full cursor-pointer rounded-xl border-0 bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!rawKey.trim() || !detected || isSaving}
              type="submit"
            >
              {isSaving ? "Verifying & Saving…" : "Save & Verify"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 border-t border-slate-100" />

          {/* Saved keys list */}
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Saved Keys</p>
          {isLoadingKeys ? (
            <div className="flex items-center gap-2 py-3 text-[13px] text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              Loading…
            </div>
          ) : savedKeys.length ? (
            <ul className="grid gap-2">
              {savedKeys.map((key) => {
                const info = PROVIDER_PATTERNS.find((p) => p.provider === key.provider);
                return (
                  <li
                    key={key.provider}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PROVIDER_COLORS[key.provider] || "bg-slate-100 border-slate-200 text-slate-600"}`}>
                        {info?.emoji} {key.provider}
                      </span>
                      <code className="text-[12px] font-mono text-slate-600 truncate">{key.masked_key}</code>
                    </div>
                    <button
                      className="ml-2 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      disabled={isDeleting === key.provider}
                      onClick={() => handleDelete(key.provider)}
                      type="button"
                    >
                      {isDeleting === key.provider ? "…" : "Remove"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-center text-[13px] text-slate-400">
              No keys saved yet.<br />
              <span className="text-[11px] opacity-70">A saved Gemini key will be used automatically for all AI chat.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
