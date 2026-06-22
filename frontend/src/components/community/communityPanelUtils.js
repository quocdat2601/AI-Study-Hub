const COMMUNITY_PANELS = new Set(["find", "new", "people"]);

export function normalizeCommunityPanel(value, fallback = "find") {
  const normalized = String(value || "").trim().toLowerCase();
  return COMMUNITY_PANELS.has(normalized) ? normalized : fallback;
}

export function buildCommunityPanelSearch({ panel = "find", composeType = "", documentId = "" } = {}) {
  const nextPanel = normalizeCommunityPanel(panel);
  const params = new URLSearchParams();
  params.set("panel", nextPanel);

  if (nextPanel === "new" && composeType) {
    params.set("compose", composeType);

    if (composeType === "document_share" && documentId) {
      params.set("documentId", documentId);
    }
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}
