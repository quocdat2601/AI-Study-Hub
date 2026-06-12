import { buildCommunityPanelSearch } from "./communityPanelUtils.js";

export const CREATE_POST_RULES = Object.freeze({
  titleMin: 10,
  titleMax: 255,
  bodyMin: 20,
  bodyMax: 5000,
});

const COMPOSE_TYPE_ALIASES = Object.freeze({
  discussion: "discussion",
  question: "question",
  document: "document_share",
  document_share: "document_share",
  ai_study_log: "ai_study_log",
});

export const MAX_POST_SUBJECTS = 3;

export function getPostTypeLabel(postType) {
  if (postType === "discussion") return "Discussion";
  if (postType === "document_share") return "Document Share";
  if (postType === "ai_study_log") return "AI Study Log";
  return "Question";
}

export function normalizeComposeType(value) {
  return COMPOSE_TYPE_ALIASES[String(value || "").trim().toLowerCase()] || "";
}

export function buildComposeSearch(draft) {
  return buildCommunityPanelSearch({
    panel: "new",
    composeType: normalizeComposeType(draft?.postType) || "discussion",
    documentId: draft?.documentId || "",
  });
}

export function getComposerContent(postType) {
  if (postType === "discussion") {
    return {
      titlePlaceholder: "Name the topic, opinion, or discussion you want classmates to join",
      bodyPlaceholder: "Share the context, your perspective, and the discussion you want other students to continue.",
      bodyHint: "Keep the angle clear so classmates can decide quickly if the thread is relevant.",
      attachmentEmpty: "",
    };
  }

  if (postType === "document_share") {
    return {
      titlePlaceholder: "Summarize what this shared material helps people learn",
      bodyPlaceholder: "Explain what the document covers, which course angle it helps with, and how classmates should use it.",
      bodyHint: "Call out scope, quality, and the best study use case so the post reads like a reliable note-share.",
      attachmentEmpty: "No indexed, extraction-ready documents are available yet.",
    };
  }

  if (postType === "ai_study_log") {
    return {
      titlePlaceholder: "Name the AI study log you want classmates to open",
      bodyPlaceholder: "Summarize what the AI session clarified, which course problem it addressed, and what made the conversation useful.",
      bodyHint: "Focus on why this session is worth reading, not just that it exists.",
      attachmentEmpty: "No AI study sessions are available to attach yet.",
    };
  }

  return {
    titlePlaceholder: "State the exact concept or blocker you need help with",
    bodyPlaceholder: "Describe the problem, what you have tried, and where you are still blocked.",
    bodyHint: "Questions with clear context and a visible blocker are easier for classmates to answer well.",
    attachmentEmpty: "",
  };
}

export function validateDraft(draft) {
  const errors = {};
  const titleLength = draft.title.trim().length;
  const bodyLength = draft.body.trim().length;

  if (!titleLength) {
    errors.title = "Title is required.";
  } else if (titleLength < CREATE_POST_RULES.titleMin) {
    errors.title = `Title must be at least ${CREATE_POST_RULES.titleMin} characters.`;
  } else if (titleLength > CREATE_POST_RULES.titleMax) {
    errors.title = `Title must be ${CREATE_POST_RULES.titleMax} characters or fewer.`;
  }

  if (!bodyLength) {
    errors.body = "Body is required.";
  } else if (bodyLength < CREATE_POST_RULES.bodyMin) {
    errors.body = `Body must be at least ${CREATE_POST_RULES.bodyMin} characters.`;
  } else if (bodyLength > CREATE_POST_RULES.bodyMax) {
    errors.body = `Body must be ${CREATE_POST_RULES.bodyMax} characters or fewer.`;
  }

  if (draft.postType === "document_share" && !draft.documentId) {
    errors.documentId = "Select one indexed document to share.";
  }

  if (draft.postType === "ai_study_log" && !draft.chatSessionId) {
    errors.chatSessionId = "Select one AI chat session to publish.";
  }

  if ((draft.subjectIds || []).length > MAX_POST_SUBJECTS) {
    errors.subjectIds = `Select up to ${MAX_POST_SUBJECTS} subjects.`;
  }

  return errors;
}

export function mapServerErrorsToFields(message) {
  const normalized = String(message || "").trim();
  if (!normalized) return {};

  if (normalized.includes("subjectIds must contain")) {
    return { subjectIds: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("title must be at least")) {
    return { title: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("title must be") && normalized.includes("characters or fewer")) {
    return { title: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("body must be at least")) {
    return { body: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized.startsWith("body must be") && normalized.includes("characters or fewer")) {
    return { body: normalized[0].toUpperCase() + normalized.slice(1) };
  }

  if (normalized === "Document not found" || normalized.includes("ready extraction")) {
    return { documentId: normalized };
  }

  if (normalized === "Chat session not found" || normalized.includes("active community study log")) {
    return { chatSessionId: normalized };
  }

  return {};
}

export function dedupeSubjectIds(values) {
  return [...new Set((values || []).map((value) => String(value)).filter(Boolean))];
}

export function mergeSubjectIds(currentValues, nextValues, limit = MAX_POST_SUBJECTS) {
  return dedupeSubjectIds([...(currentValues || []), ...(nextValues || [])]).slice(0, limit);
}

export function getSelectedSubjects(subjects, subjectIds) {
  const selectedSet = new Set((subjectIds || []).map(String));
  return subjects.filter((subject) => selectedSet.has(String(subject.id)));
}
