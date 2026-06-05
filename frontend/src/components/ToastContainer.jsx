import React from "react";

const ICONS = {
  success: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f5ee] text-[#087443] text-lg font-bold">
      ✓
    </span>
  ),
  error: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fee2e2] text-[#b42318] text-lg font-bold">
      !
    </span>
  ),
  warning: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff7e6] text-[#975a16] text-lg font-bold">
      !
    </span>
  ),
  info: (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0ff] text-[#4648d4] text-lg font-bold">
      i
    </span>
  ),
  progress: (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f0ff] text-[#4648d4] text-xs font-black">
      PDF
    </span>
  ),
};

export default function ToastContainer({ toasts, onClose }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-[100] grid w-[min(360px,calc(100vw-24px))] gap-3">
      {toasts.map((toast) => (
        <article
          className="relative rounded-xl border border-[#e5e9ef] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
          key={toast.id}
        >
          <button
            className="absolute right-3 top-3 border-0 bg-transparent text-[#94a3b8] cursor-pointer text-lg leading-none"
            onClick={() => onClose(toast.id)}
            type="button"
            aria-label="Close"
          >
            ×
          </button>

          <div className="flex gap-3 pr-6">
            {ICONS[toast.type] || ICONS.info}
            <div className="min-w-0 flex-1">
              <strong className="block text-sm text-[#172033]">{toast.title}</strong>
              {toast.message ? (
                <p className="m-0 mt-1 text-sm text-[#66758a]">{toast.message}</p>
              ) : null}

              {toast.type === "progress" ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-[#66758a]">
                    <span>Uploading...</span>
                    <span>{toast.progress || 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e6e8ea]">
                    <span
                      className="block h-full rounded-full bg-[#4648d4] transition-all duration-200"
                      style={{ width: `${toast.progress || 0}%` }}
                    />
                  </div>
                  {toast.onCancel ? (
                    <button
                      className="mt-2 border-0 bg-transparent text-xs font-bold text-[#4648d4] cursor-pointer"
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
                  className="mt-2 border-0 bg-transparent p-0 text-sm font-bold text-[#4648d4] cursor-pointer"
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
