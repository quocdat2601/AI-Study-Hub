const { genAI } = require('../config/gemini');
const embeddingConfig = require('../config/embeddings');

const EMBEDDING_TIMEOUT_MS = 20000;

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Embedding request timed out'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function normalizeEmbedding(values) {
  const embedding = (values || []).map(Number).filter((value) => Number.isFinite(value));
  if (embedding.length !== embeddingConfig.dimensions) {
    throw new Error(`Embedding dimension mismatch. Expected ${embeddingConfig.dimensions}, got ${embedding.length}`);
  }
  return embedding;
}

function extractEmbeddings(response) {
  const embeddings = response?.embeddings || [];
  return embeddings.map((item) => normalizeEmbedding(item.values));
}

async function embedTexts(texts, taskType) {
  const cleanTexts = (texts || []).map((text) => String(text || '').trim());
  if (!cleanTexts.length) return [];
  if (!genAI) {
    throw new Error('Gemini API key is not configured for embeddings');
  }

  const response = await withTimeout(
    genAI.models.embedContent({
      model: embeddingConfig.model,
      contents: cleanTexts,
      config: {
        taskType,
        outputDimensionality: embeddingConfig.dimensions,
      },
    }),
    EMBEDDING_TIMEOUT_MS
  );

  const embeddings = extractEmbeddings(response);
  if (embeddings.length !== cleanTexts.length) {
    throw new Error(`Embedding response count mismatch. Expected ${cleanTexts.length}, got ${embeddings.length}`);
  }
  return embeddings;
}

async function embedQuery(question) {
  const [embedding] = await embedTexts([question], 'RETRIEVAL_QUERY');
  return {
    embedding,
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions,
  };
}

async function embedChunks(chunks) {
  const embeddedChunks = [];
  const batchSize = Math.max(1, embeddingConfig.batchSize);

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.content), 'RETRIEVAL_DOCUMENT');
    for (let index = 0; index < batch.length; index += 1) {
      embeddedChunks.push({
        ...batch[index],
        embedding: embeddings[index],
        embeddingModel: embeddingConfig.model,
        embeddingStatus: 'ready',
        embeddingError: null,
      });
    }
  }

  return embeddedChunks;
}

function markChunksEmbeddingFailed(chunks, error) {
  const message = String(error?.message || error || 'Embedding generation failed').slice(0, 500);
  return (chunks || []).map((chunk) => ({
    ...chunk,
    embedding: null,
    embeddingModel: embeddingConfig.model,
    embeddingStatus: 'failed',
    embeddingError: message,
  }));
}

module.exports = {
  embedChunks,
  embedQuery,
  markChunksEmbeddingFailed,
};
