import React from "react";
import CommunityMiniFeatureBar from "./CommunityMiniFeatureBar.jsx";
import { cx } from "./communityUtils.js";

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
    <section className={cx("rounded-[26px] border border-[#dbe3ed] bg-white p-3 shadow-[0_16px_34px_rgba(20,31,48,0.07)] md:p-4", className)}>
      <CommunityMiniFeatureBar items={navItems} LinkComponent={LinkComponent} />

      <div className="px-3 pb-2 pt-4 md:px-4 md:pt-5">
        {helper ? <div className="mb-2">{helper}</div> : null}
        {eyebrow ? <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-[#66758a]">{eyebrow}</p> : null}

        {badges.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((badge, index) => (
              <span
                className="inline-flex min-h-7 items-center rounded-full border border-[#c7cffd] bg-[#eef2ff] px-3 text-[11px] font-black uppercase tracking-[0.7px] text-[#4648d4]"
                key={`${badge}-${index}`}
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        <h1 className="mt-2 mb-0 text-[26px] font-extrabold leading-[1.05] text-[#172033] md:text-[32px]">{title}</h1>

        {description ? <p className="mt-2 mb-0 max-w-3xl text-sm leading-6 text-[#526173]">{description}</p> : null}

        {chips.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((chip, index) => (
              <span
                className="inline-flex items-center rounded-full bg-[#f2f5f8] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.5px] text-[#42526a]"
                key={`${chip}-${index}`}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}

        {metaItems.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#66758a]">
            {metaItems.map((item, index) => (
              <span className="inline-flex items-center gap-2" key={`${item}-${index}`}>
                {index ? <span className="text-[#c0cbda]">|</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </section>
  );
}
