const { normalizeText } = require('./document-text.service');

const MAX_CONTEXT_CHARS = Number(process.env.RAG_MAX_CONTEXT_CHARS || 120000);
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 2000);
const MIN_TOKEN_LENGTH = 3;

function tokenize(text) {
  return new Set(
    normalizeText(text)
      .toLowerCase()
      .split(/[^a-z0-9À-ỹ]+/i)
      .filter((token) => token.length >= MIN_TOKEN_LENGTH)
  );
}

function formatDocumentHeader(doc, index) {
  return `Document ${index + 1}: ${doc.title || 'Untitled'} (ID: ${doc.id})`;
}

function splitIntoChunks(text) {
  const normalized = normalizeText(text);
  const chunks = [];

  for (let start = 0; start < normalized.length; start += CHUNK_SIZE) {
    chunks.push(normalized.slice(start, start + CHUNK_SIZE));
  }

  return chunks;
}

function buildFullContext(documents) {
  return documents
    .map((doc, index) => {
      return `[${formatDocumentHeader(doc, index)}]\n${normalizeText(doc.extracted_text)}`;
    })
    .join('\n\n---\n\n');
}

function scoreChunk(chunk, queryTokens) {
  if (!queryTokens.size) return 0;

  const chunkTokens = tokenize(chunk);
  let score = 0;

  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += 1;
  }

  return score;
}

function buildRankedContext(documents, query) {
  const queryTokens = tokenize(query);
  const chunks = [];

  documents.forEach((doc, docIndex) => {
    splitIntoChunks(doc.extracted_text).forEach((chunk, chunkIndex) => {
      chunks.push({
        doc,
        docIndex,
        chunkIndex,
        chunk,
        score: scoreChunk(chunk, queryTokens),
      });
    });
  });

  chunks.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.docIndex !== b.docIndex) return a.docIndex - b.docIndex;
    return a.chunkIndex - b.chunkIndex;
  });

  const selected = [];
  let total = 0;

  for (const item of chunks) {
    const block = `[${formatDocumentHeader(item.doc, item.docIndex)} | Chunk ${item.chunkIndex + 1}]\n${item.chunk}`;
    if (total + block.length > MAX_CONTEXT_CHARS && selected.length > 0) break;
    selected.push(block);
    total += block.length;
    if (total >= MAX_CONTEXT_CHARS) break;
  }

  return selected.join('\n\n---\n\n');
}

function buildDocumentContext(documents, currentMessage, recentMessages = []) {
  const readableDocs = documents.filter((doc) => doc.extraction_status === 'ready' && doc.extracted_text);
  const fullContext = buildFullContext(readableDocs);

  if (fullContext.length <= MAX_CONTEXT_CHARS) {
    return fullContext;
  }

  const recentUserText = recentMessages
    .filter((message) => message.role === 'user')
    .slice(-5)
    .map((message) => message.content)
    .join('\n');

  return buildRankedContext(readableDocs, `${recentUserText}\n${currentMessage}`);
}

module.exports = {
  buildDocumentContext,
};
