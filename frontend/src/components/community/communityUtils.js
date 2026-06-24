export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export function getSafeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getSafeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function pickObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

export function pickArray(...values) {
  return values.find(Array.isArray) || [];
}

export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(getSafeNumber(value));
}

export function formatForumDate(value, { includeTime = false } = {}) {
  if (!value) return "Unknown";

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Unknown";

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  if (!includeTime) {
    return dateFormatter.format(parsedDate);
  }

  const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateFormatter.format(parsedDate)} ${timeFormatter.format(parsedDate)}`;
}

export function formatBytes(value) {
  const size = getSafeNumber(value);
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(1)} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export function getInitials(displayName, email) {
  const source = getSafeText(displayName) || getSafeText(email) || "User";
  const sanitized = source.includes("@") ? source.split("@")[0] : source;
  const parts = sanitized
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function getUserDisplayName(user, fallback = "Student") {
  if (user?.email) {
    return user.email.split("@")[0].replace(/[._-]+/g, " ");
  }

  return fallback;
}

export function getCommunityBadgeToneClasses(tone, variant = "light") {
  const normalizedTone = getSafeText(tone, "indigo").toLowerCase();

  const lightToneMap = {
    amber: "border-[#f3d27b] bg-[#fff4d6] text-[#b45309]",
    blue: "border-[#bcd0fb] bg-[#edf4ff] text-[#4648d4]",
    emerald: "border-[#b8ebc6] bg-[#effdf4] text-[#0f8a4a]",
    indigo: "border-[#c7cffd] bg-[#eef2ff] text-[#4648d4]",
    pink: "border-[#ffc4d7] bg-[#fff0f5] text-[#db2777]",
    rose: "border-[#ffc4d7] bg-[#fff0f5] text-[#db2777]",
    slate: "border-[#c7cffd] bg-[#eef2ff] text-[#4648d4]",
    violet: "border-[#c7cffd] bg-[#eef2ff] text-[#4648d4]",
  };

  const darkToneMap = {
    amber: "border-[#5f4313] bg-[#3b2a10] text-[#ffd67a]",
    blue: "border-[#21456f] bg-[#10253f] text-[#87c4ff]",
    emerald: "border-[#1f513e] bg-[#0f3024] text-[#7ee2b8]",
    pink: "border-[#69304d] bg-[#39172a] text-[#ff9ecf]",
    rose: "border-[#69304d] bg-[#39172a] text-[#ff9ecf]",
    slate: "border-[#334155] bg-[#16202c] text-[#cdd8e5]",
    violet: "border-[#523884] bg-[#281a45] text-[#c7a6ff]",
    indigo: "border-[#523884] bg-[#281a45] text-[#c7a6ff]",
  };

  const toneMap = variant === "dark" ? darkToneMap : lightToneMap;
  return toneMap[normalizedTone] || toneMap.indigo;
}

export function renderMarkdownBody(text, React, onImageClick) {
  if (!text || typeof text !== "string") return null;

  const lines = text.split("\n");
  const nodes = [];

  function parseInline(line) {
    const parts = [];
    const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|!\[([^\]]*)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }

      if (match[2] !== undefined) {
        parts.push(React.createElement("strong", { key: `b-${match.index}` }, match[2]));
      } else if (match[3] !== undefined) {
        parts.push(React.createElement("em", { key: `i-${match.index}` }, match[3]));
      } else if (match[5] !== undefined) {
        const imgSrc = match[5];
        const imgAlt = match[4] || "";
        const imgElement = React.createElement("img", {
          key: `img-${match.index}`,
          src: imgSrc,
          alt: imgAlt,
          className: "my-2 max-w-full rounded-xl border border-[#e4e0d8] cursor-zoom-in hover:opacity-95 transition",
          style: { maxHeight: "480px", display: "block" },
          onClick: onImageClick ? (e) => {
            e.preventDefault();
            onImageClick(imgSrc);
          } : undefined
        });

        parts.push(
          onImageClick
            ? imgElement
            : React.createElement("a", {
                key: `img-link-${match.index}`,
                href: imgSrc,
                target: "_blank",
                rel: "noopener noreferrer"
              }, imgElement)
        );
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return parts;
  }

  lines.forEach((line, index) => {
    const inlineParts = parseInline(line);
    const hasImage = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);

    if (hasImage) {
      nodes.push(React.createElement("span", { key: `line-${index}`, className: "block" }, inlineParts));
    } else if (line.trim() === "") {
      nodes.push(React.createElement("br", { key: `br-${index}` }));
    } else {
      nodes.push(React.createElement("span", { key: `line-${index}`, className: "block" }, inlineParts));
    }
  });

  return nodes;
}
