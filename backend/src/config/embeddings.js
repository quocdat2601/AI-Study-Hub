const provider = process.env.EMBEDDING_PROVIDER || 'gemini';
const model = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 768);
const batchSize = Number(process.env.EMBEDDING_BATCH_SIZE || 8);

module.exports = {
  provider,
  model,
  dimensions,
  batchSize,
};
