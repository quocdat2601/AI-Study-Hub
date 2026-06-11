const aiProviders = require('../config/ai-providers');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');

function buildModeInstruction(mode) {
  if (mode === 'document_only') {
    return [
      'Answer mode: document_only.',
      'Use only the provided source chunks.',
      'Do not use outside knowledge.',
      'If the chunks do not contain the answer, say clearly that the document does not contain enough information.',
    ].join('\n');
  }

  return [
    'Answer mode: hybrid.',
    'Always use two sections titled exactly "Based on the document" and "Additional study explanation".',
    'In "Based on the document", answer only from the provided source chunks.',
    'If the chunks are insufficient, explicitly say: "The document does not provide enough information to fully answer this."',
    'In "Additional study explanation", add concise general academic or software knowledge that helps the student understand the topic.',
    'Do not cite or imply that general knowledge came from the document.',
    'Keep the answer concise and useful.',
  ].join('\n');
}

function buildRagPrompts({ question, documentTitle, chunks, mode }) {
  const context = (chunks || [])
    .map((chunk, index) => {
      const label = chunk.chunk_index ?? index;
      return `[Source ${index + 1} | chunk ${label}]\n${chunk.content}`;
    })
    .join('\n\n');

  const systemPrompt = `You are AI Study Hub's study assistant.\n\n${buildModeInstruction(mode)}`;
  const userPrompt = `Selected document title:\n${documentTitle || 'Untitled document'}\n\nRetrieved source chunks:\n${context || 'No source chunks were available.'}\n\nUser question:\n${question}`;

  return { systemPrompt, userPrompt };
}

async function generateAnswer({ provider, model, question, documentTitle, chunks, mode }) {
  const prompts = buildRagPrompts({ question, documentTitle, chunks, mode });

  if (provider === 'ollama') {
    const result = await ollamaService.generateChat({
      model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
    });

    return {
      answer: result.text,
      provider,
      model: result.model,
      usageMetadata: result.usageMetadata,
    };
  }

  const result = await geminiService.queryDocumentChunks({
    question,
    documentTitle,
    chunks,
    mode,
    model,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
  });

  return {
    answer: result.text,
    provider: 'gemini',
    model: result.model,
    usageMetadata: result.usageMetadata,
  };
}

async function getModelStatus() {
  const ollama = await ollamaService.getStatus();
  return {
    defaultProvider: aiProviders.defaultProvider,
    defaultModel: aiProviders.getDefaultModel(),
    gemini: {
      available: Boolean(process.env.GEMINI_API_KEY),
      models: aiProviders.gemini.allowedModels,
      allowedModels: aiProviders.gemini.allowedModels,
      defaultModel: aiProviders.gemini.defaultModel,
    },
    ollama,
  };
}

module.exports = {
  generateAnswer,
  getModelStatus,
};
