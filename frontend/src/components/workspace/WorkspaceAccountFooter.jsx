import React from "react";
import { Link } from "react-router-dom";
import { getDisplayName } from "../../lib/userDisplay.js";
import { LogOutIcon, SettingsIcon } from "./WorkspaceIcons.jsx";

function formatPlanLabel(plan) {
  if (!plan) return "Student Plan";
  const normalized = String(plan).replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function WorkspaceAccountFooter({ user, onLogout }) {
  const displayName = getDisplayName(user);
  const initials = displayName.slice(0, 2).toUpperCase();
  const planLabel = formatPlanLabel(user?.plan);

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c45c26] text-sm font-bold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold leading-tight text-slate-900">
            {displayName}
          </strong>
          <span className="block truncate text-xs text-slate-500">{planLabel}</span>
        </span>
      </div>

      <Link
        className="no-caret mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8f2ff] px-3 py-2.5 text-sm font-semibold text-[#5b4fd4] no-underline transition hover:bg-[#dcecff]"
        to="/account"
      >
        <SettingsIcon size={16} />
        Settings
      </Link>

      <button
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        onClick={onLogout}
        type="button"
      >
        <LogOutIcon size={16} />
        Log Out
      </button>
    </div>
  );
}
