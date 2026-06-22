import React from "react";
import { DEFAULT_NOTE_COLOR, getNoteColorOption, NOTE_COLOR_OPTIONS } from "../../utils/workspaceNotebookColors.js";

export default function WorkspaceNotebookColorPicker({ disabled = false, onChange, value = DEFAULT_NOTE_COLOR }) {
  const activeOption = getNoteColorOption(value);

  return (
    <div>
      <div
        aria-label="Bảng màu highlight"
        className="grid grid-cols-7 gap-1.5"
        role="radiogroup"
      >
        {NOTE_COLOR_OPTIONS.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              aria-checked={isActive}
              aria-label={option.label}
              className={`group relative h-7 w-7 cursor-pointer rounded-md border-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? "border-slate-800 scale-105 shadow-sm" : "border-white shadow-sm hover:scale-105 hover:border-slate-300"}`}
              disabled={disabled}
              key={option.id}
              onClick={() => onChange(option.id)}
              role="radio"
              style={{ backgroundColor: option.swatch }}
              title={option.label}
              type="button"
            >
              {isActive ? (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-900 drop-shadow-sm">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-1.5 text-[11px] font-medium text-slate-500">
        Đang chọn: <span className="text-slate-700">{activeOption.label}</span>
      </p>
    </div>
  );
}
