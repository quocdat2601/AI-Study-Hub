const createError = require('../utils/createError');
const RoadMapModel = require('../models/roadmap.model');
const documentService = require('./document.service');
const documentChunkModel = require('../models/document-chunk.model');
const aiProviders = require('../config/ai-providers');
const aiService = require('./ai.service');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');

const MAX_GOAL_CHARS = 300;
const MAX_CONTEXT_CHARS = 12000;
const ROADMAP_TIMEOUT_MS = 90000;
const ROADMAP_GEMINI_MODEL = process.env.GEMINI_ROADMAP_MODEL || 'gemini-2.5-flash-lite';

const ROADMAP_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    estimatedHours: { type: 'number' },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          estimatedHours: { type: 'number' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                type: { type: 'string' },
                estimatedMinutes: { type: 'number' },
                status: { type: 'string' },
                evidence: {
                  type: 'object',
                  properties: {
                    pageStart: { type: 'number', nullable: true },
                    pageEnd: { type: 'number', nullable: true },
                  },
                },
              },
              required: ['id', 'title', 'status'],
            },
          },
        },
        required: ['id', 'title', 'tasks'],
      },
    },
  },
  required: ['title', 'summary', 'milestones'],
};

function normalizeDocId(docId) {
  const id = Number(docId);
  if (!Number.isInteger(id) || id <= 0) throw createError(400, 'Document id is invalid');
  return id;
}

function cleanGoal(goal) {
  const value = String(goal || '').trim();
  if (!value) return null;
  if (value.length > MAX_GOAL_CHARS) {
    throw createError(400, `Goal is too long. Maximum is ${MAX_GOAL_CHARS} characters`);
  }
  return value;
}

function toPublicRoadmap(row) {
  if (!row) return null;
  const plan = row.roadmap && typeof row.roadmap === 'object' ? row.roadmap : {};
  return {
    id: row.id,
    goal: row.goal || null,
    updatedAt: row.updated_at || null,
    title: plan.title || '',
    summary: plan.summary || '',
    estimatedHours: Number(plan.estimatedHours) || 0,
    milestones: Array.isArray(plan.milestones) ? plan.milestones : [],
  };
}

function buildChunkContext(chunks, fallbackText, title) {
  if (chunks && chunks.length) {
    return chunks
      .slice(0, 6)
      .map((chunk, index) => {
        const metadata = chunk.metadata || {};
        const pageStart = metadata.pageStart ?? metadata.pageNumber;
        const pageEnd = metadata.pageEnd ?? metadata.pageNumber;
        const pageLabel = pageStart == null
          ? ''
          : pageStart === pageEnd ? ` | trang ${pageStart}` : ` | trang ${pageStart}-${pageEnd}`;
        return `[Đoạn ${index + 1}${pageLabel}]\n${chunk.promptContent || chunk.content}`;
      })
      .join('\n\n');
  }

  return fallbackText
    ? `[Nội dung tài liệu: ${title}]\n${fallbackText}`
    : '';
}

function buildRoadmapPrompts({ docTitle, goal, chunkText }) {
  const goalText = goal
    ? `Mục tiêu học của người dùng:\n${goal}\n`
    : 'Mục tiêu học: tạo lộ trình học toàn bộ tài liệu theo thứ tự hợp lý.\n';

  return {
    systemPrompt: [
      'Bạn là huấn luyện viên học tập chuyên nghiệp cho AI Study Hub.',
      'Tạo lộ trình học (roadmap) thực tế, chia theo chương/mục hoặc giai đoạn.',
      'Trả về JSON hợp lệ duy nhất, không thêm giải thích.',
      'Mỗi milestone là một giai đoạn học; mỗi task là việc cụ thể (đọc, ghi chú, ôn, làm quiz...).',
      'Tất cả title/summary phải bằng tiếng Việt.',
      'Tạo 3-6 milestones, mỗi milestone 2-5 tasks.',
      'Mọi task.status phải là "todo".',
      'Nếu không biết số trang, để evidence.pageStart/pageEnd là null.',
    ].join('\n'),
    userPrompt: [
      `Tài liệu: ${String(docTitle || 'Untitled document')}`,
      goalText,
      'Nội dung tham chiếu từ tài liệu:',
      chunkText || 'Không có nội dung.',
    ].join('\n\n'),
  };
}

function extractJsonObject(text) {
  let cleaned = String(text || '').trim();
  if (!cleaned) return null;

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) cleaned = fencedMatch[1].trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;

  const candidate = cleaned.slice(first, last + 1).replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizePlan(plan, docTitle) {
  const milestones = (Array.isArray(plan?.milestones) ? plan.milestones : []).map((milestone, milestoneIndex) => ({
    id: String(milestone?.id || `milestone-${milestoneIndex + 1}`),
    title: String(milestone?.title || `Giai đoạn ${milestoneIndex + 1}`).trim(),
    estimatedHours: Number(milestone?.estimatedHours) || 0,
    tasks: (Array.isArray(milestone?.tasks) ? milestone.tasks : []).map((task, taskIndex) => {
      const status = String(task?.status || 'todo').toLowerCase();
      return {
        id: String(task?.id || `milestone-${milestoneIndex + 1}-task-${taskIndex + 1}`),
        title: String(task?.title || `Nhiệm vụ ${taskIndex + 1}`).trim(),
        type: task?.type || 'read',
        estimatedMinutes: Number(task?.estimatedMinutes) || 30,
        status: ['todo', 'doing', 'done'].includes(status) ? status : 'todo',
        evidence: {
          pageStart: task?.evidence?.pageStart ?? null,
          pageEnd: task?.evidence?.pageEnd ?? null,
        },
      };
    }),
  })).filter((milestone) => milestone.tasks.length > 0);

  return {
    title: String(plan?.title || docTitle || 'Lộ trình học').trim(),
    summary: String(plan?.summary || '').trim(),
    estimatedHours: Number(plan?.estimatedHours) || 0,
    milestones,
  };
}

function resolveRoadmapModel(provider) {
  if (provider === 'ollama') return aiProviders.getDefaultModel();
  if (aiProviders.gemini.allowedModels.includes(ROADMAP_GEMINI_MODEL)) {
    return ROADMAP_GEMINI_MODEL;
  }
  return aiProviders.getDefaultModel();
}

async function generateRoadmapWithAi({ provider, model, prompts }) {
  if (provider === 'ollama') {
    const result = await ollamaService.generateChat({
      model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      format: ROADMAP_JSON_SCHEMA,
      options: { temperature: 0.2 },
    });
    return { text: result.text || '' };
  }

  return geminiService.generateText({
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    timeoutMs: ROADMAP_TIMEOUT_MS,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ROADMAP_JSON_SCHEMA,
      temperature: 0.2,
    },
  });
}

async function getRoadMap({ userId, docId }) {
  const id = normalizeDocId(docId);
  await documentService.getDocumentById({ id, userId });
  const existing = await RoadMapModel.findByUserAndDoc({ userId, docId: id });
  return { roadmap: toPublicRoadmap(existing) };
}

async function generateRoadMap({ userId, docId, goal }) {
  const id = normalizeDocId(docId);
  const cleanedGoal = cleanGoal(goal);

  const doc = await documentService.getDocumentById({ id, userId });
  const title = doc?.title || 'Untitled document';

  let chunks = await documentChunkModel.findByDocumentId(id).catch(() => []);
  let fallbackText = String(doc?.extracted_text || '').trim();
  fallbackText = fallbackText.slice(0, MAX_CONTEXT_CHARS);

  if (!chunks.length && !fallbackText) {
    try {
      await aiService.processDocument({ id, userId, force: false });
    } catch {
      // fall through
    }
    chunks = await documentChunkModel.findByDocumentId(id).catch(() => []);
    fallbackText = String((await documentService.getDocumentById({ id, userId }))?.extracted_text || '').trim();
    fallbackText = fallbackText.slice(0, MAX_CONTEXT_CHARS);
  }

  const chunkText = buildChunkContext(chunks, fallbackText, title);
  if (!chunkText.trim()) {
    throw createError(
      400,
      'Tài liệu chưa có nội dung chữ để tạo Roadmap. Hãy chạy Process/Index tài liệu hoặc upload bản PDF có text (không phải scan).'
    );
  }

  const provider = aiProviders.defaultProvider;
  const model = resolveRoadmapModel(provider);
  const prompts = buildRoadmapPrompts({ docTitle: title, goal: cleanedGoal, chunkText });

  let result;
  try {
    result = await generateRoadmapWithAi({ provider, model, prompts });
  } catch (err) {
    if (err.publicMessage) throw err;
    if (String(err.message || '').toLowerCase().includes('timed out')) {
      throw createError(503, 'AI phản hồi quá chậm. Hãy thử lại sau vài giây.');
    }
    throw createError(503, 'Không thể gọi AI để tạo lộ trình. Hãy thử lại.');
  }
  const json = extractJsonObject(result.text);
  const roadmap = normalizePlan(json, title);

  if (!roadmap.milestones.length) {
    throw createError(
      500,
      'AI không tạo được lộ trình học. Hãy thử lại hoặc nhập mục tiêu cụ thể hơn.'
    );
  }

  const saved = await RoadMapModel.upsert({
    userId,
    docId: id,
    goal: cleanedGoal,
    roadmap,
  });

  return { roadmap: toPublicRoadmap(saved) };
}

async function updateTaskStatus({ userId, docId, taskId, status }) {
  const id = normalizeDocId(docId);
  const cleanedTaskId = String(taskId || '').trim();
  const cleanedStatus = String(status || '').trim().toLowerCase();
  if (!cleanedTaskId) throw createError(400, 'taskId is required');
  if (!['todo', 'doing', 'done'].includes(cleanedStatus)) {
    throw createError(400, 'status must be todo, doing, or done');
  }

  await documentService.getDocumentById({ id, userId });
  const existing = await RoadMapModel.findByUserAndDoc({ userId, docId: id });
  if (!existing) throw createError(404, 'RoadMap not found');

  const roadmap = existing.roadmap || {};
  const milestones = Array.isArray(roadmap.milestones) ? roadmap.milestones : [];
  let updated = false;

  const nextMilestones = milestones.map((m) => {
    const tasks = Array.isArray(m.tasks) ? m.tasks : [];
    const nextTasks = tasks.map((t) => {
      if (String(t.id) !== cleanedTaskId) return t;
      updated = true;
      return { ...t, status: cleanedStatus };
    });
    return { ...m, tasks: nextTasks };
  });

  if (!updated) throw createError(404, 'Task not found');

  const nextRoadmap = { ...roadmap, milestones: nextMilestones };
  const saved = await RoadMapModel.updateRoadmap({ userId, docId: id, roadmap: nextRoadmap });
  return { roadmap: toPublicRoadmap(saved) };
}

module.exports = {
  getRoadMap,
  generateRoadMap,
  updateTaskStatus,
};
