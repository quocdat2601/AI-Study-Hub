import React from "react";

function Thumbnail({ document }) {
  if (document.image) {
    return (
      <img
        className="h-full w-full object-contain object-center p-4"
        src={document.image}
        alt=""
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6">
      <div className="flex h-full w-[72%] max-w-[140px] flex-col gap-2 rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm">
        <span className="h-2 w-4/5 rounded bg-indigo-100" />
        <span className="h-2 w-full rounded bg-slate-100" />
        <span className="h-2 w-3/4 rounded bg-slate-100" />
        <span className="mt-auto text-[10px] font-bold uppercase tracking-wide text-indigo-600">
          {document.fileType || "PDF"}
        </span>
      </div>
    </div>
  );
}

export default function DocumentCard({ document, highlighted = false }) {
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(70,72,212,0.12)] ${
        highlighted
          ? "shadow-[0_12px_32px_rgba(70,72,212,0.14)] ring-1 ring-indigo-200"
          : "shadow-[0_4px_20px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80"
      }`}
    >
      <div className="relative aspect-[5/3] overflow-hidden bg-slate-100">
        <Thumbnail document={document} />
        {highlighted ? (
          <span className="absolute left-3 top-3 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
            Top pick
          </span>
        ) : null}
        {document.pages ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
            {document.pages}
          </span>
        ) : null}
        {document.badge ? (
          <span className="absolute bottom-3 left-3 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {document.badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-600">
          {document.course}
        </p>
        <h3
          className="m-0 mb-2 line-clamp-2 text-[15px] font-bold leading-snug text-slate-900"
          title={document.title}
        >
          {document.title}
        </h3>
        {document.description ? (
          <p className="m-0 mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">
            {document.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <footer className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
              {document.initials}
            </span>
            <span className="truncate text-sm font-medium text-slate-700">{document.author}</span>
          </div>
          <span className="shrink-0 text-xs font-medium text-slate-400">{document.rating}</span>
        </footer>
      </div>
    </article>
  );
}
