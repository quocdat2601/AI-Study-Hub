import React from "react";
import CommunityMiniFeatureBar from "./CommunityMiniFeatureBar.jsx";
import { cx, getCommunityBadgeToneClasses } from "./communityUtils.js";

export default function CommunityBanner({
  eyebrow = "",
  title,
  description = "",
  helper = null,
  navItems = [],
  badges = [],
  chips = [],
  metaItems = [],
  children = null,
  LinkComponent = "a",
  className = "",
}) {
  return (
    <section className={cx("rounded-2xl border border-[#e4e0d8] bg-white shadow-sm overflow-hidden", className)}>
      <div className="bg-gradient-to-b from-[#faf9f6] to-white p-5 md:p-6 pb-6">
        {helper ? <div className="mb-2">{helper}</div> : null}
        {eyebrow ? <p className="m-0 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b6660]">{eyebrow}</p> : null}

        {badges.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {badges.map((badge, index) => {
              const label = typeof badge === "string" ? badge : badge?.label;
              const tone = typeof badge === "string" ? "indigo" : badge?.tone;
              return (
                <span
                  className={cx(
                    "inline-flex min-h-6 items-center rounded px-2 text-[10px] font-bold uppercase tracking-[0.5px]",
                    getCommunityBadgeToneClasses(tone, "light")
                  )}
                  key={`${label}-${index}`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        ) : null}

        <h1 className="mt-2 mb-0 text-2xl font-extrabold tracking-tight text-[#1a1a2e] md:text-3xl">{title}</h1>

        {description ? <p className="mt-2 mb-0 max-w-3xl text-sm leading-relaxed text-[#6b6660]">{description}</p> : null}

        {chips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip, index) => (
              <span
                className="inline-flex items-center rounded bg-[#f0ece4] px-2.5 py-1 text-[11px] font-semibold text-[#6b6660]"
                key={`${chip}-${index}`}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {metaItems.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#6b6660]">
            {metaItems.map((item, index) => (
              <span className="inline-flex items-center gap-1.5" key={`${item}-${index}`}>
                {index ? <span className="text-[#e8e4dc]">|</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}
      </div>

      {navItems && navItems.length > 0 ? (
        <div className="px-5 md:px-6 bg-white border-t border-[#e8e4dc]">
          <CommunityMiniFeatureBar items={navItems} LinkComponent={LinkComponent} className="border-b-0" />
        </div>
      ) : null}
    </section>
  );
}
