import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const carouselRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTrendingDocuments() {
      try {
        const data = await listTrendingDocuments(12);
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

  function scrollCarousel(direction) {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.scrollBy({
      left: direction * Math.max(280, Math.round(carousel.clientWidth * 0.82)),
      behavior: "smooth",
    });
  }

  return (
    <section className="relative px-6 py-16 md:px-8" id="courses">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

          <div className="flex items-center gap-2">
            <button
              aria-label="Previous documents"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => scrollCarousel(-1)}
              type="button"
            >
              {"<"}
            </button>
            <button
              aria-label="Next documents"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => scrollCarousel(1)}
              type="button"
            >
              {">"}
            </button>
            <Link
              className="ml-1 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 no-underline transition hover:text-indigo-800"
              to="/documents"
            >
              View all
              <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="workspace-scrollbar flex gap-5 overflow-x-auto pb-4">
            {Array.from({ length: 4 }, (_, item) => (
              <div className="h-[360px] min-w-[min(82vw,320px)] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/80 sm:min-w-[320px] lg:min-w-[340px]" key={item} />
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
          <div
            className="workspace-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
            ref={carouselRef}
          >
            {mappedDocuments.map((document, index) => (
              <div
                className="min-w-[min(82vw,320px)] snap-start sm:min-w-[320px] lg:min-w-[340px]"
                key={`${document.title}-${index}`}
              >
                <DocumentCard
                  document={document}
                  highlighted={index === 0}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
