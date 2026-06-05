import React from "react";

function IconBase({ children, className = "h-5 w-5", ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CloudStorageIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M7 18h11a3 3 0 0 0 .4-5.98A4.5 4.5 0 0 0 8.2 8.7 3.5 3.5 0 0 0 7 18Z" />
    </IconBase>
  );
}

export function DocumentFileIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h8l4 4v13H6v-17Z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </IconBase>
  );
}

export function BookmarkIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 4.5h12v16l-6-4-6 4v-16Z" />
    </IconBase>
  );
}

export function MessagesIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M7 8h10v8H11l-4 3V8Z" />
      <path d="M13 8h7v6h-4l-3 2.5V8Z" />
    </IconBase>
  );
}

export function UploadIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 16V6" />
      <path d="M8 10l4-4 4 4" />
      <path d="M4 18h16" />
    </IconBase>
  );
}

export function SparklesIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3l1.4 4.2L17.6 9 13.4 10.2 12 14.4 10.6 10.2 6.4 9l4.2-1.8L12 3Z" />
      <path d="M5 16l.8 2.4L8.2 19l-2.4.8L5 22.2 3.8 19.8 1.4 19l2.4-.8L5 16Z" />
      <path d="M19 14l.6 1.8L21.4 17l-1.8.6L19 19.4 18.2 17.6 16.4 17l1.8-.6L19 14Z" />
    </IconBase>
  );
}

export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </IconBase>
  );
}

export function HelpIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.7 2.7 0 0 1 5 1.4c0 1.6-2.5 2-2.5 3.6" />
      <circle cx="12" cy="17.2" r="0.8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function BellIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M15 17H9c-2.2 0-4-1.8-4-4V10c0-3.3 2.7-6 6-6s6 2.7 6 6v3c0 2.2-1.8 4-4 4Z" />
      <path d="M10 17v1a2 2 0 0 0 4 0v-1" />
    </IconBase>
  );
}

export function ChevronRightIcon(props) {
  return (
    <IconBase strokeWidth="2" {...props}>
      <path d="M9 6l6 6-6 6" />
    </IconBase>
  );
}

export function ClockIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function FolderOpenIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 7.5h6l2 2h10v9H3v-11Z" />
      <path d="M3 7.5V6a1 1 0 0 1 1-1h5l2 2" />
    </IconBase>
  );
}

export function GraduationCapIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 12.2V16a5 5 0 0 0 10 0v-3.8" />
      <path d="M21 10v6" />
    </IconBase>
  );
}

export function ExternalLinkIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 10v9H5V5h9" />
    </IconBase>
  );
}

export function PdfFileIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3.5h8l4 4v13H6v-17Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.5" />
      <path d="M14 3.5v4h4" stroke="#EF4444" strokeWidth="1.5" />
      <text x="8" y="17" fill="#EF4444" fontSize="5" fontWeight="700">PDF</text>
    </svg>
  );
}

export function DocxFileIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3.5h8l4 4v13H6v-17Z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.5" />
      <path d="M14 3.5v4h4" stroke="#2563EB" strokeWidth="1.5" />
      <text x="7" y="17" fill="#2563EB" fontSize="4.5" fontWeight="700">DOC</text>
    </svg>
  );
}

export function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </span>
      <h2 className="m-0 text-lg font-semibold text-slate-900">{children}</h2>
    </div>
  );
}

export const statIconStyles = {
  storage: "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
  documents: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
  bookmarks: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
  chats: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
};

export function StatIconBadge({ tone, children }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${statIconStyles[tone]}`}>
      {children}
    </span>
  );
}

export function DocumentTypeIcon({ mimeType, className = "h-8 w-8" }) {
  if (mimeType === "application/pdf") {
    return <PdfFileIcon className={className} />;
  }
  if (mimeType?.includes("wordprocessingml")) {
    return <DocxFileIcon className={className} />;
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 ${className}`}>
      <DocumentFileIcon className="h-4 w-4" />
    </span>
  );
}
