import React from "react";
import DocumentCard from "./DocumentCard.jsx";

const featuredDocument = {
  badge: "Premium Guide",
  course: "Introduction to Macroeconomics",
  title: "Complete Semester Notes: Principles of Economics 101",
  description:
    "A comprehensive 150-page guide covering everything from supply and demand to fiscal policy, with detailed graphs and AI-generated summaries.",
  image: "/landing/economics.jpg",
  initials: "JD",
  author: "John Doe • Yale University",
  rating: "4.9 ★ (1.2k)",
};

const documents = [
  {
    course: "Biology",
    title: "Cellular Mitosis & DNA Replication...",
    school: "Stanford University",
    image: "/landing/biology.jpg",
    pages: "12 Pages",
  },
  {
    course: "Architecture",
    title: "History of Modern Urban Planning...",
    school: "MIT",
    image: "/landing/architecture.jpg",
    pages: "45 Pages",
  },
  {
    course: "Law",
    title: "International Human Rights Case...",
    school: "University of Oxford",
    image: "/landing/law.jpg",
  },
  {
    course: "Mathematics",
    title: "Advanced Calculus III Exam...",
    school: "ETH Zurich",
    image: "/landing/math.jpg",
  },
];

export default function TrendingDocuments() {
  return (
    <section className="mx-auto max-w-[1280px] px-8 py-16" id="courses">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-[28px] leading-[1.28] tracking-normal m-0">Trending at your University</h2>
          <p className="text-[#464554] leading-[1.5] mt-1 mb-0">The most viewed documents this week</p>
        </div>
        <a className="text-[#4648d4] text-sm font-extrabold no-underline whitespace-nowrap" href="#courses">View all ›</a>
      </div>

      <div className="grid gap-6 grid-cols-4">
        <DocumentCard document={featuredDocument} featured />
        {documents.map((document) => (
          <DocumentCard key={document.title} document={document} />
        ))}
      </div>
    </section>
  );
}
