import React from "react";
import HeroSearch from "./HeroSearch.jsx";

export default function LandingHero() {
  return (
    <section className="bg-white/55 overflow-hidden pt-24 px-6 pb-16 relative">
      <div className="mx-auto max-w-[896px] text-center">
        <h1 className="text-[36px] leading-[1.25] tracking-normal mx-auto mb-5 max-w-[780px]">Find the best study documents to pass your exams with flying colours</h1>
        <p className="text-[#464554] text-lg leading-[1.55] mx-auto max-w-[704px] mt-0 mb-0">
          Access shared study resources from your academic community, organize course materials, and prepare for
          document-grounded AI support.
        </p>
        <HeroSearch />
      </div>
    </section>
  );
}
