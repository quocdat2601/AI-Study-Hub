const aiService = require('../services/ai.service');
const aiProviderService = require('../services/ai-provider.service');
const aiUsageService = require('../services/ai-usage.service');
const studyMaterialService = require('../services/study-material.service');

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

async function getModelStatus(req, res, next) {
  try {
    res.json(await aiProviderService.getModelStatus());
  } catch (err) {
    next(err);
  }
}

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
