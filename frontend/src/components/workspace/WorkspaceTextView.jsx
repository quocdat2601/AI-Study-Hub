import React from "react";

function EmptyTextState({ document }) {
  const status = document?.extractionStatus;
  const error = document?.extractionError;

  if (status === "pending") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-slate-800">Đang trích xuất text...</p>
        <p className="m-0 text-sm leading-relaxed text-slate-500">
          Hệ thống đang đọc nội dung từ file. Chuyển sang <strong>PDF</strong> để đọc ngay.
        </p>
      </>
    );
  }

  if (status === "failed") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-slate-800">Không có text</p>
        <p className="m-0 text-sm leading-relaxed text-slate-500">
          {error || "Không đọc được text từ file này."} Bạn vẫn đọc bản PDF ở tab <strong>PDF</strong>.
        </p>
      </>
    );
  }

  if (status === "empty") {
    return (
      <>
        <p className="m-0 mb-2 text-base font-semibold text-amber-800">PDF scan (ảnh chụp)</p>
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          File <strong>{document?.title}</strong> không có lớp chữ chọn được.
          Đọc đầy đủ nội dung ở tab <strong>PDF</strong>. AI chat cần PDF có text gõ sẵn.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="m-0 mb-2 text-base font-semibold text-slate-800">Chưa có text</p>
      <p className="m-0 text-sm leading-relaxed text-slate-500">
        Chuyển sang <strong>PDF</strong> để đọc file gốc.
      </p>
    </>
  );
}

export default function WorkspaceTextView({ document }) {
  const paragraphs = String(document?.extractedText || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return (
      <div className="workspace-selectable flex min-h-full items-start justify-center px-5 py-8">
        <div className="w-full max-w-[620px] select-text rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <EmptyTextState document={document} />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-selectable min-h-full px-4 py-6 sm:px-6">
      <article className="mx-auto w-full max-w-[620px] select-text rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
          Nội dung text
        </p>
        <h1 className="mb-6 text-xl font-bold leading-snug text-slate-900">{document.title}</h1>
        {paragraphs.map((paragraph, index) => (
          <p className="mb-3 text-[15px] leading-[1.75] text-slate-700" key={index}>
            {paragraph}
          </p>
        ))}
      </article>
    </div>
  );
}
