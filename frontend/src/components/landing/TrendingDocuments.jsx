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
    <section className="trending-section" id="courses">
      <div className="landing-section-heading">
        <div>
          <h2>Trending at your University</h2>
          <p>The most viewed documents this week</p>
        </div>
        <a href="#courses">View all ›</a>
      </div>

      <div className="document-bento">
        <DocumentCard document={featuredDocument} featured />
        {documents.map((document) => (
          <DocumentCard key={document.title} document={document} />
        ))}
      </div>
    </section>
  );
}
