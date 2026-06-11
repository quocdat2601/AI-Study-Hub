const SUBJECT_COLORS = {
  CS301: "#3b6fd4",
  CS202: "#7c4dbd",
  CS302: "#2d9e6b",
  MLN131: "#3b6fd4",
  DEFAULT: "#5b6af8",
};

export function getSubjectColor(code) {
  if (!code) return SUBJECT_COLORS.DEFAULT;
  const key = String(code).toUpperCase();
  return SUBJECT_COLORS[key] || SUBJECT_COLORS.DEFAULT;
}
