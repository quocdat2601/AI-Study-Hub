import React from "react";
import { cx } from "./communityUtils.js";

function MiniFeatureItem({ item, LinkComponent }) {
  const isActive = Boolean(item?.isActive);
  const label = item?.label || "";
  const className = cx(
    "inline-flex items-center justify-center border-b-2 px-4 pb-3 pt-2 text-sm font-semibold transition-colors whitespace-nowrap no-underline",
    isActive
      ? "border-[#4648d4] text-[#4648d4]"
      : "border-transparent text-[#6b6660] hover:border-[#c9c4b8] hover:text-[#1a1a2e]"
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
    <div className={cx("flex items-center gap-1 border-b border-[#e8e4dc]", className)}>
      {items.map((item) => (
        <MiniFeatureItem item={item} key={item.id || item.label} LinkComponent={LinkComponent} />
      ))}
    </div>
  );
}
