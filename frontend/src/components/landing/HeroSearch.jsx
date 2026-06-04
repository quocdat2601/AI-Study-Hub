import React from "react";

export default function HeroSearch() {
  return (
    <form className="hero-search" role="search">
      <span className="hero-search__icon" aria-hidden="true">
        ⌕
      </span>
      <input aria-label="Search study documents" placeholder="Search for your course, book or school..." />
      <button type="submit">Search</button>
    </form>
  );
}
