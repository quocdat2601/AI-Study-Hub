const SELECTED_MODEL_STORAGE_KEY = "aiStudyHub.workspace.selectedModel";
const SELECTED_SESSIONS_STORAGE_KEY = "aiStudyHub.workspace.sessionsByDocument";

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

function readStoredLastOpenedDocumentId() {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem("aiStudyHub.workspace.lastOpenedDocumentId");
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}

function writeStoredLastOpenedDocumentId(id) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem("aiStudyHub.workspace.lastOpenedDocumentId", String(id));
    } else {
      window.localStorage.removeItem("aiStudyHub.workspace.lastOpenedDocumentId");
    }
  } catch {}
}

function readStoredSessions() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SELECTED_SESSIONS_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeStoredSessions(sessions) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_SESSIONS_STORAGE_KEY, JSON.stringify(sessions || {}));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
}

const workspaceCache = {
  documents: null,
  selectedId: readStoredLastOpenedDocumentId(),
  messagesBySessionId: {},
  processResultsByDocId: {},
  scrollTopByDocId: {},
  selectedModelByDocId: {},
  sessionsByDocId: readStoredSessions(),
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
  const sessionId = workspaceCache.sessionsByDocId[key] || null;
  return {
    messages: sessionId ? workspaceCache.messagesBySessionId[String(sessionId)] || [] : [],
    processResult: workspaceCache.processResultsByDocId[key] || null,
    scrollTop: workspaceCache.scrollTopByDocId[key],
    selectedModel: workspaceCache.selectedModelByDocId[key] || "",
    sessionId,
  };
}

export function cacheDocumentChat(docId, updates) {
  const key = docKey(docId);
  if (!key) return;

  if (Object.prototype.hasOwnProperty.call(updates, "messages")) {
    const sessionId = updates.sessionId || workspaceCache.sessionsByDocId[key];
    if (sessionId) workspaceCache.messagesBySessionId[String(sessionId)] = updates.messages || [];
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
    writeStoredSessions(workspaceCache.sessionsByDocId);
  }
}

export function removeCachedSession(sessionId) {
  const normalizedId = Number(sessionId);
  for (const [key, value] of Object.entries(workspaceCache.sessionsByDocId)) {
    if (Number(value) === normalizedId) workspaceCache.sessionsByDocId[key] = null;
  }
  writeStoredSessions(workspaceCache.sessionsByDocId);
  delete workspaceCache.messagesBySessionId[String(sessionId)];
}

export function getCachedSessionMessages(sessionId) {
  return workspaceCache.messagesBySessionId[String(sessionId || "")] || [];
}

export function cacheSessionMessages(sessionId, messages) {
  if (!sessionId) return;
  workspaceCache.messagesBySessionId[String(sessionId)] = messages || [];
}

export function cacheWorkspaceState(updates) {
  Object.assign(workspaceCache, updates);
  if (Object.prototype.hasOwnProperty.call(updates, "selectedModel")) {
    writeStoredSelectedModel(updates.selectedModel || "");
  }
  if (Object.prototype.hasOwnProperty.call(updates, "selectedId") && updates.selectedId !== null) {
    writeStoredLastOpenedDocumentId(updates.selectedId);
  }
}
