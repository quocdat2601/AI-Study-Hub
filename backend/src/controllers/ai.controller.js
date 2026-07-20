const aiService = require('../services/ai.service');
const aiProviderService = require('../services/ai-provider.service');
const aiUsageService = require('../services/ai-usage.service');
const studyMaterialService = require('../services/study-material.service');

/**
 * Initiates document text extraction and AI abstract summary generation processing.
 * @param {object} req - Request parameters containing the document ID.
 * @param {object} res - Response JSON returning processing status.
 * @param {Function} next - Error middleware callback.
 */
async function processDocument(req, res, next) {
  try {
    res.json(await aiService.processDocument({
      id: req.params.id,
      userId: req.user.id,
      force: req.body?.force !== false,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Re-triggers document metadata/overview generation in case of failures.
 * @param {object} req - Request containing target document ID.
 * @param {object} res - Response confirmation.
 * @param {Function} next - Error middleware callback.
 */
async function retryDocumentOverview(req, res, next) {
  try {
    res.json(await aiService.retryDocumentOverview({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Fetches the persisted learning roadmap and the caller's step completion progress.
 * @param {object} req - Request parameters containing the document ID.
 * @param {object} res - Response returning roadmap (or null) with completed step orders.
 * @param {Function} next - Error middleware callback.
 */
async function getDocumentRoadmap(req, res, next) {
  try {
    res.json(await aiService.getDocumentRoadmap({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Regenerates the document learning roadmap from existing chunks.
 * @param {object} req - Request parameters containing the document ID.
 * @param {object} res - Response returning the regenerated roadmap.
 * @param {Function} next - Error middleware callback.
 */
async function retryDocumentRoadmap(req, res, next) {
  try {
    res.json(await aiService.retryDocumentRoadmap({
      id: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Marks a roadmap step as completed or not completed for the caller.
 * @param {object} req - Request containing document ID, step order and completed flag.
 * @param {object} res - Response returning updated completed step orders.
 * @param {Function} next - Error middleware callback.
 */
async function toggleRoadmapStep(req, res, next) {
  try {
    res.json(await aiService.toggleRoadmapStep({
      id: req.params.id,
      userId: req.user.id,
      stepOrder: req.params.stepOrder,
      completed: req.body?.completed === true,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Lists the caller's in-progress roadmaps (started but not finished) for the dashboard widget.
 * @param {object} req - Request with optional limit query param.
 * @param {object} res - Response returning progress summaries sorted by latest activity.
 * @param {Function} next - Error middleware callback.
 */
async function listRoadmapsInProgress(req, res, next) {
  try {
    res.json(await aiService.listRoadmapsInProgress({
      userId: req.user.id,
      limit: req.query.limit,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Submits queries against a singular private document source index.
 * @param {object} req - Request containing document ID and question payload.
 * @param {object} res - Response returning complete AI response text.
 * @param {Function} next - Error middleware callback.
 */
async function askDocument(req, res, next) {
  try {
    res.json(await aiService.askDocument({
      id: req.params.id,
      userId: req.user.id,
      question: req.body.question,
      displayQuestion: req.body.displayQuestion,
      mode: req.body.mode,
      model: req.body.model,
      focusedDocumentId: req.body.focusedDocumentId,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Submits queries against a full workspace chat session (multiple documents RAG contexts).
 * @param {object} req - Request containing session ID and question text.
 * @param {object} res - Response returning complete AI response text.
 * @param {Function} next - Error middleware callback.
 */
async function askSession(req, res, next) {
  try {
    res.json(await aiService.askSession({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      question: req.body.question,
      displayQuestion: req.body.displayQuestion,
      mode: req.body.mode,
      model: req.body.model,
      focusedDocumentId: req.body.focusedDocumentId,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Submits queries against a singular document source returning a Server-Sent Events (SSE) stream.
 * @param {object} req - Request containing query context details.
 * @param {object} res - Event stream output writer.
 */
async function askDocumentStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  function sendEvent(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await aiService.askDocumentStream({
      id: req.params.id,
      userId: req.user.id,
      question: req.body.question,
      displayQuestion: req.body.displayQuestion,
      mode: req.body.mode,
      model: req.body.model,
      focusedDocumentId: req.body.focusedDocumentId,
      sendEvent,
    });
    res.end();
  } catch (err) {
    sendEvent('error', {
      error: err.publicMessage || err.message || 'AI service is temporarily unavailable. Please try again',
    });
    res.end();
  }
}

/**
 * Submits queries against a chat session context returning a Server-Sent Events (SSE) stream.
 * @param {object} req - Request containing session context and question.
 * @param {object} res - Event stream output writer.
 */
async function askSessionStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  function sendEvent(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await aiService.askSessionStream({
      sessionId: req.params.sessionId,
      userId: req.user.id,
      question: req.body.question,
      displayQuestion: req.body.displayQuestion,
      mode: req.body.mode,
      model: req.body.model,
      focusedDocumentId: req.body.focusedDocumentId,
      sendEvent,
    });
    res.end();
  } catch (err) {
    sendEvent('error', {
      error: err.publicMessage || err.message || 'AI service is temporarily unavailable. Please try again',
    });
    res.end();
  }
}

/**
 * Fetches token metrics usage limits.
 * @param {object} req - Request containing selected model name.
 * @param {object} res - Response returning limits metrics mapping.
 * @param {Function} next - Error middleware callback.
 */
async function getUsage(req, res, next) {
  try {
    res.json(await aiUsageService.getUsage({
      model: req.query.model,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves availability states of both Google Gemini and local Ollama model engines.
 * @param {object} req - Request parameters context.
 * @param {object} res - Response status maps.
 * @param {Function} next - Error middleware callback.
 */
async function getModelStatus(req, res, next) {
  try {
    res.json(await aiProviderService.getModelStatus());
  } catch (err) {
    next(err);
  }
}

/**
 * Fetches generated workspace study materials lists (flashcards, quizzes, mindmaps).
 * @param {object} req - Request query containing document ID.
 * @param {object} res - Response list.
 * @param {Function} next - Error middleware callback.
 */
async function getMaterials(req, res, next) {
  try {
    res.json(await studyMaterialService.getMaterials({
      docId: req.query.docId,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Requests AI study material generation for workspace index nodes.
 * @param {object} req - Request body containing material type and target provider model.
 * @param {object} res - Response returning generated material.
 * @param {Function} next - Error middleware callback.
 */
async function generateMaterial(req, res, next) {
  try {
    res.json(await studyMaterialService.generateMaterial({
      docId: req.body.docId,
      userId: req.user.id,
      materialType: req.body.materialType,
      model: req.body.model,
    }));
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a previously generated study material record.
 * @param {object} req - Request parameters containing target material ID.
 * @param {object} res - Response confirmation.
 * @param {Function} next - Error middleware callback.
 */
async function deleteMaterial(req, res, next) {
  try {
    res.json(await studyMaterialService.deleteMaterial({
      materialId: req.params.id,
      userId: req.user.id,
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  processDocument,
  retryDocumentOverview,
  getDocumentRoadmap,
  retryDocumentRoadmap,
  toggleRoadmapStep,
  listRoadmapsInProgress,
  askDocument,
  askDocumentStream,
  askSession,
  askSessionStream,
  getUsage,
  getModelStatus,
  getMaterials,
  generateMaterial,
  deleteMaterial,
};
