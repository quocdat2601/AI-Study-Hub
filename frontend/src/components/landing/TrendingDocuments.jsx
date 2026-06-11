import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DocumentCard from "./DocumentCard.jsx";
import { listTrendingDocuments } from "../../services/documentApi.js";

function initialsFromTitle(title = "AI") {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "AI";
}

function estimatePages(bytes = 0) {
  const pages = Math.max(1, Math.round(Number(bytes || 0) / 50000));
  return `${pages} pages`;
}

function getFileType(doc) {
  return doc.fileType || "PDF";
}

export default function TrendingDocuments() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTrendingDocuments() {
      try {
        const data = await listTrendingDocuments(6);
        if (isMounted) setDocuments(Array.isArray(data) ? data : []);
      } catch {
        if (isMounted) setDocuments([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTrendingDocuments();
    return () => {
      isMounted = false;
    };
  }, []);

  const mappedDocuments = useMemo(() => documents.map((doc) => {
    const course = doc.subject || doc.subjectCode || "Study material";
    const viewCount = Number(doc.viewCount || 0);
    const description = doc.previewText || "Public study document available for preview and AI-assisted review.";

    return {
      badge: `${viewCount} views`,
      course,
      title: doc.title,
      description,
      image: doc.thumbnailUrl || null,
      fileType: getFileType(doc),
      initials: initialsFromTitle(doc.title),
      author: doc.subjectCode || "Community",
      rating: `${viewCount} views`,
      pages: estimatePages(doc.fileSizeBytes),
    };
  }), [documents]);

  return (
    <section className="relative px-6 py-20 md:px-8" id="courses">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              Popular resources
            </p>
            <h2 className="m-0 text-3xl font-extrabold tracking-tight text-slate-900 md:text-[2rem]">
              Trending at your university
            </h2>
            <p className="mb-0 mt-2 text-base leading-relaxed text-slate-500">
              The most viewed public documents from students on campus right now.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 no-underline transition hover:text-indigo-800"
            to="/documents"
          >
            View all documents
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div className="h-[360px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80" key={item} />
            ))}
          </div>
        ) : mappedDocuments.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center ring-1 ring-slate-200/80">
            <p className="m-0 text-base font-semibold text-slate-800">No public documents yet</p>
            <p className="mx-auto mb-6 mt-2 max-w-md text-sm text-slate-500">
              Upload study materials or seed demo data to populate this section.
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white no-underline transition hover:bg-indigo-700"
              to="/documents"
            >
              Browse documents
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mappedDocuments.map((document, index) => (
              <DocumentCard
                key={`${document.title}-${index}`}
                document={document}
                highlighted={index === 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
