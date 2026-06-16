const SELECTED_MODEL_STORAGE_KEY = "aiStudyHub.workspace.selectedModel";

function readStoredSelectedModel() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredSelectedModel(model) {
  if (typeof window === "undefined") return;

  try {
    if (model) {
      window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, model);
    } else {
      window.localStorage.removeItem(SELECTED_MODEL_STORAGE_KEY);
    }
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

const workspaceCache = {
  documents: null,
  selectedId: null,
  messagesByDocId: {},
  processResultsByDocId: {},
  scrollTopByDocId: {},
  selectedModelByDocId: {},
  sessionsByDocId: {},
  selectedModel: readStoredSelectedModel(),
  availableModels: null,
  modelStatus: null,
  usage: null,
  answerMode: "hybrid",
};

function docKey(docId) {
  return String(docId || "");
}

export function getWorkspaceCache() {
  return workspaceCache;
}

export function getCachedDocumentChat(docId) {
  const key = docKey(docId);
  return {
    messages: workspaceCache.messagesByDocId[key] || [],
    processResult: workspaceCache.processResultsByDocId[key] || null,
    scrollTop: workspaceCache.scrollTopByDocId[key],
    selectedModel: workspaceCache.selectedModelByDocId[key] || "",
    sessionId: workspaceCache.sessionsByDocId[key] || null,
  };
}

export function cacheDocumentChat(docId, updates) {
  const key = docKey(docId);
  if (!key) return;

  if (Object.prototype.hasOwnProperty.call(updates, "messages")) {
    workspaceCache.messagesByDocId[key] = updates.messages || [];
  }
  if (Object.prototype.hasOwnProperty.call(updates, "processResult")) {
    workspaceCache.processResultsByDocId[key] = updates.processResult || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "scrollTop")) {
    workspaceCache.scrollTopByDocId[key] = updates.scrollTop || 0;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "selectedModel")) {
    workspaceCache.selectedModelByDocId[key] = updates.selectedModel || "";
  }
  if (Object.prototype.hasOwnProperty.call(updates, "sessionId")) {
    workspaceCache.sessionsByDocId[key] = updates.sessionId || null;
  }
}

export function cacheWorkspaceState(updates) {
  Object.assign(workspaceCache, updates);
  if (Object.prototype.hasOwnProperty.call(updates, "selectedModel")) {
    writeStoredSelectedModel(updates.selectedModel || "");
  }
}
