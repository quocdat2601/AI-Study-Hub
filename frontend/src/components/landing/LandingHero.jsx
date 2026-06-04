import React from "react";
import HeroSearch from "./HeroSearch.jsx";

export default function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__content">
        <h1>Find the best study documents to pass your exams with flying colours</h1>
        <p>
          Access shared study resources from your academic community, organize course materials, and prepare for
          document-grounded AI support.
        </p>
        <HeroSearch />
      </div>
    </section>
  );
}
