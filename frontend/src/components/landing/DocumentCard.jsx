import React from "react";

export default function DocumentCard({ document, featured = false }) {
  if (featured) {
    return (
      <article className="document-feature-card">
        <div className="document-feature-card__image">
          <img src={document.image} alt="" />
          <span>{document.badge}</span>
        </div>
        <div className="document-feature-card__body">
          <p className="document-card__course">{document.course}</p>
          <h3>{document.title}</h3>
          <p>{document.description}</p>
          <footer>
            <div className="document-author">
              <span>{document.initials}</span>
              <strong>{document.author}</strong>
            </div>
            <span>{document.rating}</span>
          </footer>
        </div>
      </article>
    );
  }

  return (
    <article className="document-small-card">
      <div className="document-small-card__image">
        <img src={document.image} alt="" />
        {document.pages ? <span>{document.pages}</span> : null}
      </div>
      <div className="document-small-card__body">
        <p>{document.course}</p>
        <h3>{document.title}</h3>
        <span>{document.school}</span>
      </div>
    </article>
  );
}
