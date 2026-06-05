import React, { useEffect, useMemo, useState } from "react";
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
  return `${pages} Pages`;
}

function getFileType(doc) {
  const mime = doc.cloud_files?.mime_type || "";
  if (mime.includes("word")) return "DOC";
  if (mime.includes("pdf")) return "PDF";
  return "DOC";
}

export default function TrendingDocuments() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTrendingDocuments() {
      try {
        const data = await listTrendingDocuments(5);
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
    const course = doc.subjects?.name || doc.subjects?.code || "Study Material";
    const viewCount = Number(doc.view_count || 0);
    const description = doc.extracted_text
      ? `${doc.extracted_text.slice(0, 150)}${doc.extracted_text.length > 150 ? "..." : ""}`
      : "A student-uploaded study document ready for library search, preview, and future AI Q&A.";

    return {
      badge: `${viewCount} views`,
      course,
      title: doc.title,
      description,
      image: doc.thumbnailUrl || null,
      fileType: getFileType(doc),
      initials: initialsFromTitle(doc.title),
      author: doc.subjects?.code || "AI Study Hub",
      rating: `${viewCount} views`,
      school: doc.subjects?.code || "AI Study Hub",
      pages: estimatePages(doc.cloud_files?.size_bytes),
    };
  }), [documents]);

  const [featuredDocument, ...restDocuments] = mappedDocuments;

  return (
    <section className="mx-auto max-w-[1280px] px-8 py-16" id="courses">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-[28px] leading-[1.28] tracking-normal m-0">Trending at your University</h2>
          <p className="text-[#464554] leading-[1.5] mt-1 mb-0">The most viewed documents this week</p>
        </div>
        <a className="text-[#4648d4] text-sm font-extrabold no-underline whitespace-nowrap" href="#courses">View all &gt;</a>
      </div>

      {isLoading ? (
        <div className="grid gap-6 grid-cols-4">
          <div className="col-span-2 row-span-2 h-[480px] rounded-xl bg-white border border-[#d9dde6] animate-pulse" />
          {[0, 1, 2, 3].map((item) => (
            <div className="h-[260px] rounded-xl bg-white border border-[#d9dde6] animate-pulse" key={item} />
          ))}
        </div>
      ) : mappedDocuments.length === 0 ? (
        <div className="rounded-xl border border-[#d9dde6] bg-white p-8 text-center text-[#464554]">
          No public documents yet. Seed demo data or upload documents to fill this section.
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-4">
          <DocumentCard document={featuredDocument} featured />
          {restDocuments.map((document) => (
            <DocumentCard key={document.title} document={document} />
          ))}
        </div>
      )}
    </section>
  );
}
