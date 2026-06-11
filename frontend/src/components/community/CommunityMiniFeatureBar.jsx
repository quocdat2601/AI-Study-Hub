import React from "react";
import { cx } from "./communityUtils.js";

function MiniFeatureItem({ item, LinkComponent }) {
  const isActive = Boolean(item?.isActive);
  const label = item?.label || "";
  const className = cx(
    "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-extrabold no-underline transition",
    isActive
      ? "border border-[#cfd8e6] bg-white text-[#172033] shadow-[0_6px_16px_rgba(20,31,48,0.08)]"
      : "border border-transparent bg-transparent text-[#526173] hover:border-[#d5deea] hover:bg-white hover:text-[#172033]"
  );

  if (item?.to) {
    const navProps = typeof LinkComponent === "string" ? { href: item.to } : { to: item.to };
    return (
      <LinkComponent {...navProps} className={className}>
        {label}
      </LinkComponent>
    );
  }

  return (
    <button className={className} onClick={item?.onClick} type="button">
      {label}
    </button>
  );
}

export default function CommunityMiniFeatureBar({
  items = [],
  LinkComponent = "a",
  className = "",
}) {
  if (!items.length) return null;

  return (
    <div className={cx("rounded-[22px] border border-[#dbe3ed] bg-[#f3f6fb] p-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <MiniFeatureItem item={item} key={item.id || item.label} LinkComponent={LinkComponent} />
        ))}
      </div>
    </div>
  );
}
