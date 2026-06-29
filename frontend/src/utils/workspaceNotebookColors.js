export const NOTE_COLOR_OPTIONS = [
  { id: "yellow", label: "Vàng", swatch: "#facc15", fill: "rgba(250, 204, 21, 0.5)", ring: "rgba(202, 138, 4, 0.65)", stripBg: "#fef9c3", stripText: "#713f12" },
  { id: "amber", label: "Hổ phách", swatch: "#f59e0b", fill: "rgba(245, 158, 11, 0.45)", ring: "rgba(217, 119, 6, 0.65)", stripBg: "#fef3c7", stripText: "#78350f" },
  { id: "orange", label: "Cam", swatch: "#fb923c", fill: "rgba(251, 146, 60, 0.45)", ring: "rgba(234, 88, 12, 0.6)", stripBg: "#ffedd5", stripText: "#7c2d12" },
  { id: "red", label: "Đỏ", swatch: "#f87171", fill: "rgba(248, 113, 113, 0.45)", ring: "rgba(220, 38, 38, 0.6)", stripBg: "#fee2e2", stripText: "#7f1d1d" },
  { id: "rose", label: "Hồng đậm", swatch: "#fb7185", fill: "rgba(251, 113, 133, 0.42)", ring: "rgba(225, 29, 72, 0.6)", stripBg: "#ffe4e6", stripText: "#881337" },
  { id: "pink", label: "Hồng", swatch: "#f472b6", fill: "rgba(244, 114, 182, 0.42)", ring: "rgba(219, 39, 119, 0.6)", stripBg: "#fce7f3", stripText: "#831843" },
  { id: "purple", label: "Tím", swatch: "#c084fc", fill: "rgba(192, 132, 252, 0.42)", ring: "rgba(126, 34, 206, 0.6)", stripBg: "#f3e8ff", stripText: "#581c87" },
  { id: "indigo", label: "Chàm", swatch: "#818cf8", fill: "rgba(129, 140, 248, 0.42)", ring: "rgba(67, 56, 202, 0.6)", stripBg: "#e0e7ff", stripText: "#312e81" },
  { id: "blue", label: "Xanh dương", swatch: "#60a5fa", fill: "rgba(96, 165, 250, 0.45)", ring: "rgba(37, 99, 235, 0.6)", stripBg: "#dbeafe", stripText: "#1e3a8a" },
  { id: "cyan", label: "Xanh lơ", swatch: "#22d3ee", fill: "rgba(34, 211, 238, 0.4)", ring: "rgba(8, 145, 178, 0.6)", stripBg: "#cffafe", stripText: "#164e63" },
  { id: "teal", label: "Xanh ngọc", swatch: "#2dd4bf", fill: "rgba(45, 212, 191, 0.42)", ring: "rgba(13, 148, 136, 0.6)", stripBg: "#ccfbf1", stripText: "#134e4a" },
  { id: "green", label: "Xanh lá", swatch: "#4ade80", fill: "rgba(74, 222, 128, 0.45)", ring: "rgba(22, 163, 74, 0.6)", stripBg: "#dcfce7", stripText: "#14532d" },
  { id: "lime", label: "Xanh chanh", swatch: "#a3e635", fill: "rgba(163, 230, 53, 0.42)", ring: "rgba(101, 163, 13, 0.6)", stripBg: "#ecfccb", stripText: "#365314" },
  { id: "gray", label: "Xám", swatch: "#9ca3af", fill: "rgba(156, 163, 175, 0.42)", ring: "rgba(75, 85, 99, 0.55)", stripBg: "#f3f4f6", stripText: "#374151" },
];

const COLOR_MAP = Object.fromEntries(NOTE_COLOR_OPTIONS.map((option) => [option.id, option]));

export const DEFAULT_NOTE_COLOR = "yellow";

export const NOTE_COLOR_IDS = NOTE_COLOR_OPTIONS.map((option) => option.id);

export function normalizeNoteColor(color) {
  return COLOR_MAP[color] ? color : DEFAULT_NOTE_COLOR;
}

export function getNoteColorOption(color) {
  return COLOR_MAP[normalizeNoteColor(color)];
}

export function getHighlightStyle(color) {
  const option = getNoteColorOption(color);
  return {
    backgroundColor: option.fill,
    boxShadow: `inset 0 0 0 1px ${option.ring}`,
  };
}

export function getHighlightHoverStyle(color) {
  const option = getNoteColorOption(color);
  return {
    backgroundColor: option.fill.replace(/0\.\d+\)$/, "0.72)"),
    boxShadow: `inset 0 0 0 1px ${option.ring}`,
  };
}

export function getQuoteStripStyle(color) {
  const option = getNoteColorOption(color);
  return {
    backgroundColor: option.stripBg,
    color: option.stripText,
  };
}
