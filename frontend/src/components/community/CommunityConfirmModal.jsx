import React from "react";

export default function CommunityConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDanger = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.58)] px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[28px] border border-[#dbe3ed] bg-white p-6 shadow-[0_32px_70px_rgba(15,23,42,0.28)]">
        <h2 className="text-2xl font-extrabold text-[#172033]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#526173]">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#dbe3ed] bg-transparent px-5 text-sm font-extrabold text-[#172033] hover:bg-slate-50 transition"
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className={`inline-flex min-h-10 items-center justify-center rounded-xl px-5 text-sm font-extrabold text-white transition ${
              isDanger
                ? "bg-[#d32f2f] hover:bg-[#b71c1c]"
                : "bg-[#172033] hover:bg-slate-800"
            }`}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
