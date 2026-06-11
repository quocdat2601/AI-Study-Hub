import React from "react";
import { Eye, FileText } from "lucide-react";

function Thumbnail({ document }) {
  if (document.image) {
    return (
      <img
        alt=""
        className="h-full w-full object-cover object-top"
        loading="lazy"
        src={document.image}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#4648d4]/10 via-[#eef2ff] to-[#f8fafc] p-5">
      <div className="flex w-full max-w-[200px] flex-col items-center gap-3 rounded-xl border border-[#dbeafe] bg-white/90 p-5 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2ff] text-[#4648d4]">
          <FileText size={22} />
        </span>
        <span className="text-center text-xs font-bold uppercase tracking-wide text-[#4648d4]">
          {document.fileType || "PDF"}
        </span>
        <span className="line-clamp-2 text-center text-[11px] leading-snug text-[#64748b]">
          {document.title}
        </span>
      </div>
    </div>
  );
}

/** Card tài liệu — cùng chiều cao, placeholder rõ khi không có thumbnail. */
export default function DocumentCard({ document }) {
  return (
    <article className="group flex h-full min-h-[380px] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#c7d2fe] hover:shadow-[0_16px_40px_rgba(70,72,212,0.12)]">
      <div className="relative h-48 shrink-0 overflow-hidden bg-[#f1f5f9]">
        <Thumbnail document={document} />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4648d4] px-3 py-1 text-xs font-semibold text-white">
          <Eye size={12} />
          {document.badge}
        </span>
        {document.pages ? (
          <span className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#475569] shadow-sm">
            {document.pages}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="m-0 mb-2 text-xs font-bold uppercase tracking-wide text-[#4648d4]">
          {document.course}
        </p>
        <h3 className="m-0 mb-2 line-clamp-2 text-[16px] font-semibold leading-snug text-[#0f172a]">
          {document.title}
        </h3>
        <p className="m-0 mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-[#64748b]">
          {document.description}
        </p>

        <footer className="mt-auto flex items-center justify-between border-t border-[#f1f5f9] pt-4 text-sm text-[#64748b]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-bold text-[#4648d4]">
              {document.initials}
            </span>
            <span className="truncate font-medium text-[#334155]">{document.author}</span>
          </div>
          <span className="shrink-0 text-xs font-medium">{document.rating}</span>
        </footer>
      </div>
    </article>
  );
}
