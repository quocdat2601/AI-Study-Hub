import React from "react";

const ICONS = {
  success: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f5ee] text-lg font-bold text-[#087443] dark:bg-emerald-950 dark:text-emerald-300">
      ✓
    </span>
  ),
  error: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fee2e2] text-lg font-bold text-[#b42318] dark:bg-red-950 dark:text-red-300">
      !
    </span>
  ),
  warning: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7e6] text-lg font-bold text-[#975a16] dark:bg-amber-950 dark:text-amber-300">
      !
    </span>
  ),
  info: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0ff] text-lg font-bold text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300">
      i
    </span>
  ),
  progress: (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f0ff] text-xs font-black text-[#4648d4] dark:bg-indigo-950 dark:text-indigo-300">
      PDF
    </span>
  ),
};

export default function ToastContainer({ toasts, onClose }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-5 top-5 z-[100] grid w-[min(360px,calc(100vw-24px))] gap-3">
      {toasts.map((toast) => (
        <article
          className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
          key={toast.id}
        >
          <button
            className="absolute right-3 top-3 cursor-pointer border-0 bg-transparent text-lg leading-none text-slate-400 dark:text-slate-500"
            onClick={() => onClose(toast.id)}
            type="button"
            aria-label="Close"
          >
            ×
          </button>

          <div className="flex gap-3 pr-6">
            {ICONS[toast.type] || ICONS.info}
            <div className="min-w-0 flex-1">
              <strong className="block text-sm text-slate-900 dark:text-slate-100">{toast.title}</strong>
              {toast.message ? (
                <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">{toast.message}</p>
              ) : null}

              {toast.type === "progress" ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Uploading...</span>
                    <span>{toast.progress || 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <span
                      className="block h-full rounded-full bg-indigo-600 transition-all duration-200"
                      style={{ width: `${toast.progress || 0}%` }}
                    />
                  </div>
                  {toast.onCancel ? (
                    <button
                      className="mt-2 cursor-pointer border-0 bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400"
                      onClick={toast.onCancel}
                      type="button"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : null}

              {toast.actionLabel && toast.onAction ? (
                <button
                  className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-indigo-600 dark:text-indigo-400"
                  onClick={toast.onAction}
                  type="button"
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
