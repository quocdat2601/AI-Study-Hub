const { getDocumentRoadmapConfig } = require('../config/document-roadmap');
const documentRoadmapModel = require('../models/document-roadmap.model');
const documentChunkModel = require('../models/document-chunk.model');
const documentOverviewService = require('./document-overview.service');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const createError = require('../utils/createError');

const ROADMAP_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          description: { type: 'string' },
          objectives: {
            type: 'array',
            items: { type: 'string' },
          },
          suggestedQuestions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['heading', 'description', 'objectives', 'suggestedQuestions'],
      },
    },
  },
  required: ['title', 'goal', 'steps'],
};

const MIN_STEPS = 1;
const MAX_STEPS = 12;

function normalizeText(value, maxLength = 4000) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function stripJsonFence(text) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();
  const fullFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence) return fullFence[1].trim();
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractTopLevelJsonObject(text) {
  const source = stripJsonFence(text);
  const start = source.indexOf('{');
  if (start < 0) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source;
}

function normalizeJsonCandidate(text) {
  return extractTopLevelJsonObject(text)
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function parseRoadmapJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(normalizeJsonCandidate(rawText));
  } catch (err) {
    throw new Error(`Invalid roadmap JSON: ${err.message}`, { cause: err });
  }

  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  // Không tin field order do AI trả — gán lại tuần tự 1..N theo thứ tự mảng
  const steps = rawSteps
    .map((item) => ({
      heading: normalizeText(item?.heading || item?.title || '', 160),
      description: normalizeText(item?.description || item?.summary || '', 400),
      objectives: (Array.isArray(item?.objectives) ? item.objectives : [])
        .map((objective) => normalizeText(objective, 200))
        .filter(Boolean)
        .slice(0, 4),
      questions: (Array.isArray(item?.suggestedQuestions) ? item.suggestedQuestions : [])
        .map((question) => normalizeText(question, 200))
        .filter(Boolean)
        .slice(0, 3),
    }))
    .filter((item) => item.heading)
    .slice(0, MAX_STEPS)
    .map((item, index) => ({ order: index + 1, ...item }));

  const roadmap = {
    title: normalizeText(parsed.title, 200),
    goal: normalizeText(parsed.goal, 300),
    steps,
  };

  const invalidFields = [];
  if (!roadmap.title || typeof parsed.title !== 'string') invalidFields.push('title');
  if (!Array.isArray(parsed.steps) || roadmap.steps.length < MIN_STEPS) invalidFields.push('steps');

  if (invalidFields.length) {
    throw new Error(`Invalid roadmap JSON fields: ${invalidFields.join(', ')}`);
  }

  return roadmap;
}

function buildRoadmapPrompts({ document, chunks }) {
  const chunkText = chunks.map((chunk, index) => [
    `[Representative chunk ${index + 1} | chunk_index ${chunk.chunk_index}]`,
    chunk.overviewHeading ? `Heading: ${chunk.overviewHeading}` : '',
    chunk.promptContent,
  ].filter(Boolean).join('\n')).join('\n\n');

  return {
    systemPrompt: [
      'Bạn tạo lộ trình học (learning roadmap) cho tài liệu trong AI Study Hub.',
      'Chỉ trả về JSON hợp lệ, không bọc trong văn xuôi hay markdown.',
      'Cấu trúc JSON bắt buộc:',
      '{"title":"Lộ trình học: ...","goal":"Sau lộ trình này bạn sẽ ...","steps":[{"heading":"...","description":"...","objectives":["..."],"suggestedQuestions":["...?"]}]}',
      'Dùng tên thuộc tính và giá trị chuỗi trong dấu nháy kép. Không dùng comment.',
      'QUY TẮC:',
      '- Toàn bộ nội dung BẰNG TIẾNG VIỆT (giữ nguyên thuật ngữ kỹ thuật/tên riêng như React, API, DNA).',
      '- "goal": 1 câu (tối đa 30 từ) mô tả năng lực tổng thể người học đạt được sau khi hoàn thành CẢ lộ trình, bắt đầu bằng "Sau lộ trình này bạn sẽ". Phải cụ thể theo nội dung tài liệu.',
      '- Tạo 4-8 bước học tuần tự dựa trên các representative chunks.',
      '- Thứ tự các bước phải theo đúng thứ tự nội dung xuất hiện trong tài liệu, không đảo lộn.',
      '- Mỗi heading tối đa 10 từ; mỗi description tối đa 40 từ, mô tả người học cần nắm gì ở bước đó.',
      '- Mỗi bước có "objectives": 2-4 tiêu chí cụ thể người học phải đạt để coi như hoàn thành bước đó. Mỗi tiêu chí tối đa 20 từ, bắt đầu bằng động từ năng lực như "Giải thích được", "Tính được", "Viết được", "Phân biệt được", "Áp dụng được" — phải kiểm chứng được bằng nội dung tài liệu, không chung chung kiểu "Hiểu về...".',
      '- Mỗi bước có "suggestedQuestions": 2-3 câu hỏi ngắn (mỗi câu tối đa 20 từ, kết thúc bằng dấu ?) người học nên tự hỏi để kiểm tra hiểu bài phần đó, trả lời được bằng nội dung tài liệu.',
      '- Không bịa nội dung không có trong tài liệu.',
    ].join('\n'),
    userPrompt: [
      `Document title: ${document.title || 'Untitled document'}`,
      'Representative chunks:',
      chunkText,
    ].join('\n\n'),
  };
}

async function generateWithProvider({ provider, model, prompts }) {
  if (provider === 'ollama') {
    return ollamaService.generateChat({
      model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      format: ROADMAP_JSON_SCHEMA,
      options: { temperature: 0.1 },
    });
  }

  return geminiService.generateText({
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ROADMAP_JSON_SCHEMA,
      temperature: 0.1,
    },
  });
}

function isFreshPending(roadmap, runtimeConfig = getDocumentRoadmapConfig()) {
  if (!roadmap || roadmap.status !== 'pending') return false;
  return Date.now() - new Date(roadmap.updated_at || roadmap.created_at || 0).getTime()
    < runtimeConfig.pendingTimeoutMs;
}

async function reuseRoadmapIfPossible({ document }) {
  const runtimeConfig = getDocumentRoadmapConfig();
  const reusable = await documentRoadmapModel.findReusableByFileId({
    fileId: document.file_id,
    documentId: document.id,
    roadmapVersion: runtimeConfig.roadmapVersion,
  });
  if (!reusable) return null;

  return documentRoadmapModel.markReady({
    documentId: document.id,
    fileId: document.file_id,
    roadmap: {
      title: reusable.title,
      goal: reusable.goal,
      steps: reusable.steps || [],
    },
    provider: reusable.provider,
    model: reusable.model,
    roadmapVersion: runtimeConfig.roadmapVersion,
  });
}

async function generateRoadmapForDocument({ document, chunks, force = false }) {
  const runtimeConfig = getDocumentRoadmapConfig();
  if (!runtimeConfig.enabled) return null;

  const existing = await documentRoadmapModel.findByDocumentId(document.id);
  if (isFreshPending(existing, runtimeConfig)) {
    if (force) {
      throw createError(409, 'Document roadmap generation is already in progress');
    }
    return existing;
  }

  await documentRoadmapModel.upsertPending({
    documentId: document.id,
    fileId: document.file_id,
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    roadmapVersion: runtimeConfig.roadmapVersion,
  });

  try {
    if (!force) {
      const reused = await reuseRoadmapIfPossible({ document });
      if (reused) return reused;
    }

    const representativeChunks = documentOverviewService.selectRepresentativeChunks(chunks, {
      maxChunks: runtimeConfig.maxChunks,
      maxChars: runtimeConfig.maxChars,
    });
    if (!representativeChunks.length) {
      throw new Error('No representative chunks available for roadmap generation');
    }

    const prompts = buildRoadmapPrompts({ document, chunks: representativeChunks });
    const result = await generateWithProvider({
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      prompts,
    });

    let roadmap;
    try {
      roadmap = parseRoadmapJson(result.text);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Document roadmap parse failed:', {
          provider: runtimeConfig.provider,
          model: runtimeConfig.model,
          error: err.message,
          rawPreview: normalizeText(result.text, 500),
        });
      }
      throw err;
    }

    return documentRoadmapModel.markReady({
      documentId: document.id,
      fileId: document.file_id,
      roadmap,
      provider: runtimeConfig.provider,
      model: result.model || runtimeConfig.model,
      roadmapVersion: runtimeConfig.roadmapVersion,
    });
  } catch (err) {
    return documentRoadmapModel.markFailed({
      documentId: document.id,
      fileId: document.file_id,
      error: err,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      roadmapVersion: runtimeConfig.roadmapVersion,
    });
  }
}

async function generateRoadmapBestEffort({ document, chunks }) {
  try {
    return await generateRoadmapForDocument({ document, chunks, force: false });
  } catch (err) {
    console.error(`Document roadmap generation failed for document ${document?.id}:`, err.message);
    return null;
  }
}

async function ensureChunksForDocument(document) {
  let chunks = await documentChunkModel.findByDocumentId(document.id);
  if (chunks.length) return chunks;

  const text = String(document.extracted_text || document.extractedText || '').trim();
  if (!text) return [];

  const documentTextService = require('./document-text.service');
  const ragService = require('./rag.service');
  const embeddingService = require('./embedding.service');

  if (!documentTextService.isExtractedTextUseful(text)) return [];

  const rawChunks = ragService.splitTextIntoChunks(text, {
    documentId: document.id,
    documentTitle: document.title,
    pageBoundaries: document.extraction_metadata?.pageBoundaries || [],
  });

  if (!rawChunks.length) return [];

  let chunksToSave;
  try {
    chunksToSave = await embeddingService.embedChunks(rawChunks);
  } catch (err) {
    console.error('Auto chunk embedding failed for roadmap:', err.message);
    chunksToSave = embeddingService.markChunksEmbeddingFailed(rawChunks, err);
  }

  return documentChunkModel.replaceForDocument(document.id, chunksToSave);
}

async function markStaleBestEffort(documentId) {
  try {
    return await documentRoadmapModel.markStale(documentId);
  } catch (err) {
    console.error(`Document roadmap stale mark failed for document ${documentId}:`, err.message);
    return null;
  }
}

async function retryRoadmap({ document }) {
  const runtimeConfig = getDocumentRoadmapConfig();
  if (!runtimeConfig.enabled) {
    throw createError(400, 'Document roadmap generation is disabled');
  }

  let chunks = await ensureChunksForDocument(document);
  if (!chunks.length) {
    throw createError(400, 'Document has no readable text for AI processing. Please re-process or re-upload the document.');
  }

  return generateRoadmapForDocument({ document, chunks, force: true });
}

module.exports = {
  generateRoadmapBestEffort,
  generateRoadmapForDocument,
  markStaleBestEffort,
  parseRoadmapJson,
  retryRoadmap,
};

