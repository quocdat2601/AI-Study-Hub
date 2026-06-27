const { getDocumentOverviewConfig } = require('../config/document-overview');
const documentOverviewModel = require('../models/document-overview.model');
const documentChunkModel = require('../models/document-chunk.model');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const createError = require('../utils/createError');

const OVERVIEW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    documentType: { type: 'string' },
    purpose: { type: 'string' },
    keyTopics: {
      type: 'array',
      items: { type: 'string' },
    },
    outline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['heading', 'description'],
      },
    },
  },
  required: ['summary', 'documentType', 'purpose', 'keyTopics', 'outline'],
};

function normalizeText(value, maxLength = 4000) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function getSectionHeading(chunk) {
  return normalizeText(
    chunk.metadata?.sectionHeading
      || chunk.metadata?.heading
      || chunk.metadata?.title
      || '',
    160
  );
}

function isLowInformation(content) {
  const text = normalizeText(content, 600);
  if (text.length < 40) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 8) return true;
  const uniqueRatio = new Set(words.map((word) => word.toLowerCase())).size / Math.max(words.length, 1);
  return uniqueRatio < 0.25;
}

function pushUnique(target, seen, chunk) {
  if (!chunk) return;
  const key = chunk.id ?? `${chunk.doc_id}:${chunk.chunk_index}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(chunk);
}

function pickSpaced(chunks, count) {
  if (count <= 0 || !chunks.length) return [];
  if (chunks.length <= count) return chunks;
  const picked = [];
  const step = (chunks.length - 1) / Math.max(count - 1, 1);
  for (let index = 0; index < count; index += 1) {
    picked.push(chunks[Math.round(index * step)]);
  }
  return picked;
}

function selectRepresentativeChunks(chunks, {
  maxChunks,
  maxChars,
} = {}) {
  const runtimeConfig = getDocumentOverviewConfig();
  const configuredMaxChunks = maxChunks || runtimeConfig.maxChunks;
  const configuredMaxChars = maxChars || runtimeConfig.maxChars;
  const sorted = [...(chunks || [])]
    .filter((chunk) => normalizeText(chunk.content).length)
    .sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
  const useful = sorted.filter((chunk) => !isLowInformation(chunk.content));
  const candidates = useful.length ? useful : sorted;
  const selected = [];
  const seen = new Set();

  pushUnique(selected, seen, candidates[0]);

  const introduction = candidates.find((chunk) => (
    /\b(introduction|overview|objective|purpose|background|scope|giới thiệu|mục tiêu|tổng quan)\b/i
      .test(`${getSectionHeading(chunk)} ${chunk.content}`)
  ));
  pushUnique(selected, seen, introduction);

  const headingSeen = new Set();
  for (const chunk of candidates) {
    const heading = getSectionHeading(chunk).toLowerCase();
    if (!heading || headingSeen.has(heading)) continue;
    headingSeen.add(heading);
    pushUnique(selected, seen, chunk);
    if (selected.length >= Math.max(3, Math.ceil(configuredMaxChunks * 0.6))) break;
  }

  const remainingSlots = Math.max(0, configuredMaxChunks - selected.length - 1);
  for (const chunk of pickSpaced(candidates, remainingSlots)) {
    pushUnique(selected, seen, chunk);
  }

  const conclusion = [...candidates].reverse().find((chunk) => (
    /\b(conclusion|summary|result|recommendation|kết luận|tóm tắt|đề xuất)\b/i
      .test(`${getSectionHeading(chunk)} ${chunk.content}`)
  )) || candidates[candidates.length - 1];
  pushUnique(selected, seen, conclusion);

  let remainingChars = configuredMaxChars;
  return selected.slice(0, configuredMaxChunks).map((chunk) => {
    const heading = getSectionHeading(chunk);
    const prefix = [
      `Chunk ${chunk.chunk_index ?? ''}`.trim(),
      heading ? `Heading: ${heading}` : '',
    ].filter(Boolean).join(' | ');
    const available = Math.max(200, remainingChars - prefix.length);
    const promptContent = normalizeText(chunk.content, available);
    remainingChars = Math.max(0, remainingChars - promptContent.length - prefix.length);
    return {
      ...chunk,
      promptContent,
      overviewHeading: heading,
    };
  }).filter((chunk) => chunk.promptContent);
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

function normalizeStringArray(value, maxItems = 10, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeOutline(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((item) => {
    if (typeof item === 'string') {
      return { heading: normalizeText(item, 160), description: '' };
    }
    return {
      heading: normalizeText(item?.heading || item?.title || item?.section || '', 160),
      description: normalizeText(item?.description || item?.summary || item?.purpose || '', 300),
    };
  }).filter((item) => item.heading || item.description);
}

function parseOverviewJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(normalizeJsonCandidate(rawText));
  } catch (err) {
    throw new Error(`Invalid overview JSON: ${err.message}`);
  }

  const overview = {
    summary: normalizeText(parsed.summary, 2000),
    documentType: normalizeText(parsed.documentType || parsed.document_type, 120),
    purpose: normalizeText(parsed.purpose, 500),
    keyTopics: normalizeStringArray(parsed.keyTopics || parsed.key_topics, 12),
    outline: normalizeOutline(parsed.outline),
  };

  const invalidFields = [];
  if (!overview.summary || typeof parsed.summary !== 'string') invalidFields.push('summary');
  if (!overview.documentType || typeof (parsed.documentType || parsed.document_type) !== 'string') {
    invalidFields.push('documentType');
  }
  if (!overview.purpose || typeof parsed.purpose !== 'string') invalidFields.push('purpose');
  if (!Array.isArray(parsed.keyTopics || parsed.key_topics)) invalidFields.push('keyTopics');
  if (!Array.isArray(parsed.outline)) invalidFields.push('outline');

  if (invalidFields.length) {
    throw new Error(`Invalid overview JSON fields: ${invalidFields.join(', ')}`);
  }

  return overview;
}

function buildOverviewPrompts({ document, chunks }) {
  const chunkText = chunks.map((chunk, index) => [
    `[Representative chunk ${index + 1} | chunk_index ${chunk.chunk_index}]`,
    chunk.overviewHeading ? `Heading: ${chunk.overviewHeading}` : '',
    chunk.promptContent,
  ].filter(Boolean).join('\n')).join('\n\n');

  return {
    systemPrompt: [
      'You generate compact study-document overviews for AI Study Hub.',
      'Return only valid JSON. Do not wrap the JSON in prose.',
      'The JSON shape must be:',
      '{"summary":"...","documentType":"...","purpose":"...","keyTopics":["..."],"outline":[{"heading":"...","description":"..."}]}',
      'Use double-quoted JSON property names and string values. Do not use comments.',
      'Use only the representative chunks. If a title or cover chunk is useful, combine it with substantive body evidence.',
      'Keep the summary concise and factual.',
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
      format: OVERVIEW_JSON_SCHEMA,
      options: { temperature: 0.1 },
    });
  }

  return geminiService.generateText({
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: OVERVIEW_JSON_SCHEMA,
      temperature: 0.1,
    },
  });
}

function isFreshPending(overview, runtimeConfig = getDocumentOverviewConfig()) {
  if (!overview || overview.status !== 'pending') return false;
  return Date.now() - new Date(overview.updated_at || overview.created_at || 0).getTime()
    < runtimeConfig.pendingTimeoutMs;
}

async function mapReusableSourceChunks(reusableOverview, targetChunks) {
  const sourceIds = (reusableOverview.source_chunk_ids || []).map(Number).filter(Number.isInteger);
  if (!sourceIds.length) return [];
  const sourceChunks = await documentChunkModel.findByIds(sourceIds);
  const sourceIndexes = sourceChunks
    .map((chunk) => Number(chunk.chunk_index))
    .filter(Number.isInteger);
  const targetByIndex = new Map(
    (targetChunks || []).map((chunk) => [Number(chunk.chunk_index), Number(chunk.id)])
  );
  return sourceIndexes
    .map((index) => targetByIndex.get(index))
    .filter(Number.isInteger);
}

async function reuseOverviewIfPossible({ document, chunks }) {
  const runtimeConfig = getDocumentOverviewConfig();
  const reusable = await documentOverviewModel.findReusableByFileId({
    fileId: document.file_id,
    documentId: document.id,
    overviewVersion: runtimeConfig.overviewVersion,
  });
  if (!reusable) return null;

  const sourceChunkIds = await mapReusableSourceChunks(reusable, chunks);
  return documentOverviewModel.markReady({
    documentId: document.id,
    fileId: document.file_id,
    overview: {
      summary: reusable.summary,
      documentType: reusable.document_type,
      purpose: reusable.purpose,
      keyTopics: reusable.key_topics || [],
      outline: reusable.outline || [],
      sourceChunkIds,
    },
    provider: reusable.provider,
    model: reusable.model,
    overviewVersion: runtimeConfig.overviewVersion,
  });
}

async function generateOverviewForDocument({ document, chunks, force = false }) {
  const runtimeConfig = getDocumentOverviewConfig();
  if (!runtimeConfig.enabled) return null;

  const existing = await documentOverviewModel.findByDocumentId(document.id);
  if (isFreshPending(existing, runtimeConfig)) {
    if (force) {
      throw createError(409, 'Document overview generation is already in progress');
    }
    return existing;
  }

  await documentOverviewModel.upsertPending({
    documentId: document.id,
    fileId: document.file_id,
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    overviewVersion: runtimeConfig.overviewVersion,
  });

  try {
    if (!force) {
      const reused = await reuseOverviewIfPossible({ document, chunks });
      if (reused) return reused;
    }

    const representativeChunks = selectRepresentativeChunks(chunks);
    if (!representativeChunks.length) {
      throw new Error('No representative chunks available for overview generation');
    }

    const prompts = buildOverviewPrompts({ document, chunks: representativeChunks });
    let rawText = '';
    const result = await generateWithProvider({
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      prompts,
    });
    rawText = result.text;
    let overview;
    try {
      overview = parseOverviewJson(rawText);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Document overview parse failed:', {
          provider: runtimeConfig.provider,
          model: runtimeConfig.model,
          error: err.message,
          rawPreview: normalizeText(rawText, 500),
        });
      }
      throw err;
    }
    overview.sourceChunkIds = representativeChunks
      .map((chunk) => Number(chunk.id))
      .filter(Number.isInteger);

    return documentOverviewModel.markReady({
      documentId: document.id,
      fileId: document.file_id,
      overview,
      provider: runtimeConfig.provider,
      model: result.model || runtimeConfig.model,
      overviewVersion: runtimeConfig.overviewVersion,
    });
  } catch (err) {
    return documentOverviewModel.markFailed({
      documentId: document.id,
      fileId: document.file_id,
      error: err,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      overviewVersion: runtimeConfig.overviewVersion,
    });
  }
}

async function generateOverviewBestEffort({ document, chunks }) {
  try {
    return await generateOverviewForDocument({ document, chunks, force: false });
  } catch (err) {
    console.error(`Document overview generation failed for document ${document?.id}:`, err.message);
    return null;
  }
}

async function markStaleBestEffort(documentId) {
  try {
    return await documentOverviewModel.markStale(documentId);
  } catch (err) {
    console.error(`Document overview stale mark failed for document ${documentId}:`, err.message);
    return null;
  }
}

async function retryOverview({ document }) {
  const runtimeConfig = getDocumentOverviewConfig();
  if (!runtimeConfig.enabled) {
    throw createError(400, 'Document overview generation is disabled');
  }

  const chunks = await documentChunkModel.findByDocumentId(document.id);
  if (!chunks.length) {
    throw createError(400, 'Document must be processed for AI before overview generation');
  }

  return generateOverviewForDocument({ document, chunks, force: true });
}

module.exports = {
  generateOverviewBestEffort,
  generateOverviewForDocument,
  markStaleBestEffort,
  parseOverviewJson,
  retryOverview,
  selectRepresentativeChunks,
};
