import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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

function formatDocumentTitle(title = "") {
  const trimmed = String(title).trim();
  if (!trimmed) return "Untitled document";

  if (!trimmed.includes(" ") && trimmed.includes("-")) {
    return trimmed
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return trimmed;
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
    const course = doc.subject || doc.subjectCode || "Study Material";
    const viewCount = Number(doc.viewCount || 0);
    const title = formatDocumentTitle(doc.title);
    const description = doc.previewText || "Public study material shared by the community.";

    return {
      id: doc.id || title,
      badge: `${viewCount} views`,
      course,
      title,
      description,
      image: doc.thumbnailUrl || null,
      fileType: getFileType(doc),
      initials: initialsFromTitle(title),
      author: doc.subjectCode || doc.subject || "Community",
      rating: `${viewCount} views`,
      pages: estimatePages(doc.fileSizeBytes),
    };
  }), [documents]);

  return (
    <section className="px-5 py-16 md:px-8" id="trending">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="m-0 text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-[#0f172a]">
              Trending at your University
            </h2>
            <p className="m-0 mt-2 text-[16px] text-[#64748b]">
              The most viewed public documents right now
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#4648d4] no-underline transition hover:gap-2"
            style={{ color: "#4648d4" }}
            to="/documents"
          >
            View all
            <ArrowRight size={16} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                className="h-[380px] animate-pulse rounded-2xl border border-[#e2e8f0] bg-white"
                key={item}
              />
            ))}
          </div>
        ) : mappedDocuments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-12 text-center">
            <p className="m-0 text-[16px] font-medium text-[#334155]">No public documents yet</p>
            <p className="m-0 mt-2 text-sm text-[#64748b]">
              Upload documents or seed demo data to populate this section.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {mappedDocuments.map((document) => (
              <DocumentCard document={document} key={document.id} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
