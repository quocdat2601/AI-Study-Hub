import api from "./api.js";
import { supabase } from "../lib/supabase.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function processDocumentForAi(id, options = {}) {
  const response = await api.post(`/ai/documents/${id}/process`, options, { timeout: 90000 });
  return response.data;
}

export async function askDocument(id, question, mode = "hybrid", model) {
  const response = await api.post(`/ai/documents/${id}/ask`, { question, mode, model }, { timeout: 90000 });
  return response.data;
}

export async function askSession(sessionId, question, mode = "hybrid", model) {
  const response = await api.post(
    `/ai/chat/sessions/${sessionId}/ask`,
    { question, mode, model },
    { timeout: 90000 }
  );
  return response.data;
}

function parseSseEvent(block) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  return {
    event,
    data: dataLines.length ? JSON.parse(dataLines.join("\n")) : null,
  };
}

async function askStream(path, { question, displayQuestion, mode = "hybrid", model, onStatus, onToken, signal }) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Missing authenticated session");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      question,
      ...(displayQuestion ? { displayQuestion } : {}),
      mode,
      model,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Could not stream AI answer");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      const parsed = parseSseEvent(block);
      if (parsed.event === "status") {
        onStatus?.(parsed.data?.message || "");
      } else if (parsed.event === "token") {
        onToken?.(parsed.data?.text || "");
      } else if (parsed.event === "done") {
        donePayload = parsed.data;
      } else if (parsed.event === "error") {
        throw new Error(parsed.data?.error || "AI stream failed");
      }
    }
  }

  if (!donePayload) {
    throw new Error("AI stream ended before completion");
  }

  return donePayload;
}

export async function askDocumentStream(id, options) {
  return askStream(`/ai/documents/${id}/ask/stream`, options);
}

export async function askSessionStream(sessionId, options) {
  return askStream(`/ai/chat/sessions/${sessionId}/ask/stream`, options);
}

export async function getAiUsage(model) {
  const response = await api.get("/ai/usage", { params: model ? { model } : {} });
  return response.data;
}

export async function getAiModelStatus() {
  const response = await api.get("/ai/models/status");
  return response.data;
}

export async function getStudyMaterials(docId) {
  const response = await api.get("/ai/materials", { params: { docId } });
  return response.data;
}

export async function generateStudyMaterial(docId, materialType, model) {
  const response = await api.post("/ai/materials/generate", { docId, materialType, model }, { timeout: 600000 });
  return response.data;
}

export async function deleteStudyMaterial(id) {
  const response = await api.delete(`/ai/materials/${id}`);
  return response.data;
}

export async function getDocumentRoadmap(docId) {
  const response = await api.get(`/ai/documents/${docId}/roadmap`);
  return response.data;
}

export async function retryDocumentRoadmap(docId) {
  const response = await api.post(`/ai/documents/${docId}/roadmap/retry`, {}, { timeout: 600000 });
  return response.data;
}

export async function toggleRoadmapStep(docId, stepOrder, completed) {
  const response = await api.patch(`/ai/documents/${docId}/roadmap/steps/${stepOrder}`, { completed });
  return response.data;
}

export async function getRoadmapsInProgress(limit = 3) {
  const response = await api.get("/ai/roadmaps/in-progress", { params: { limit } });
  return response.data;
}
