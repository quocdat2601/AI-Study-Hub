const aiUsageModel = require('../models/ai-usage.model');
const geminiConfig = require('../config/gemini');
const aiProviders = require('../config/ai-providers');
const ollamaService = require('./ollama.service');
const createError = require('../utils/createError');

function getDayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMinuteStart() {
  return new Date(Date.now() - 60 * 1000);
}

function sumUsage(rows) {
  return (rows || []).reduce((totals, row) => ({
    requests: totals.requests + Number(row.request_count || 0),
    tokens: totals.tokens + Number(row.total_tokens || 0),
  }), { requests: 0, tokens: 0 });
}

function clampRemaining(limit, used) {
  return Math.max(0, Number(limit || 0) - Number(used || 0));
}

function isUsageTableMissing(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === '42P01'
    || err?.code === 'PGRST205'
    || message.includes('ai_usage_logs')
    || message.includes('could not find the table');
}

function normalizeModel(model) {
  return aiProviders.resolveModel(model).model;
}

function resolveModel(model) {
  return aiProviders.resolveModel(model);
}

async function getUsage({ model, userId }) {
  const resolved = resolveModel(model);
  const selectedModel = resolved.model;

  if (resolved.provider === 'ollama') {
    const status = await ollamaService.getStatus();
    const installed = status.models.includes(selectedModel);
    return {
      provider: 'ollama',
      model: selectedModel,
      allowedModels: aiProviders.ollama.allowedModels,
      local: {
        available: status.available,
        installed,
        baseUrl: status.baseUrl,
        note: 'Runs on local machine performance. No API quota.',
      },
      limits: {
        rpm: null,
        tpm: null,
        rpd: null,
        dailyUserRequests: null,
      },
      used: {
        requestsThisMinute: 0,
        tokensThisMinute: 0,
        requestsToday: 0,
        userRequestsToday: 0,
      },
      remaining: {
        requestsThisMinute: null,
        tokensThisMinute: null,
        requestsToday: null,
        userRequestsToday: null,
      },
    };
  }

  let minuteRows = [];
  let todayRows = [];
  let userTodayRows = [];
  let trackingAvailable = true;

  try {
    [minuteRows, todayRows, userTodayRows] = await Promise.all([
      aiUsageModel.listSince({ model: selectedModel, since: getMinuteStart() }),
      aiUsageModel.listSince({ model: selectedModel, since: getDayStart() }),
      aiUsageModel.listSince({ model: selectedModel, since: getDayStart(), userId }),
    ]);
  } catch (err) {
    if (!isUsageTableMissing(err)) {
      throw err;
    }
    trackingAvailable = false;
  }

  const minuteUsage = sumUsage(minuteRows);
  const todayUsage = sumUsage(todayRows);
  const userTodayUsage = sumUsage(userTodayRows);
  const limits = geminiConfig.limits;

  return {
    model: selectedModel,
    provider: 'gemini',
    allowedModels: [...aiProviders.gemini.allowedModels, ...aiProviders.ollama.allowedModels],
    trackingAvailable,
    warning: trackingAvailable ? null : 'Run migration 010_ai_usage_logs.sql to enable AI usage tracking.',
    limits,
    used: {
      requestsThisMinute: minuteUsage.requests,
      tokensThisMinute: minuteUsage.tokens,
      requestsToday: todayUsage.requests,
      userRequestsToday: userTodayUsage.requests,
    },
    remaining: {
      requestsThisMinute: clampRemaining(limits.rpm, minuteUsage.requests),
      tokensThisMinute: clampRemaining(limits.tpm, minuteUsage.tokens),
      requestsToday: clampRemaining(limits.rpd, todayUsage.requests),
      userRequestsToday: clampRemaining(limits.dailyUserRequests, userTodayUsage.requests),
    },
  };
}

function createQuotaError(usage) {
  const error = createError(429, 'AI usage limit reached');
  error.responseBody = {
    error: 'AI usage limit reached',
    message: 'AI quota is temporarily unavailable. Please try again later.',
    usage,
  };
  return error;
}

async function assertQuota({ model, userId, estimatedTokens = 0 }) {
  const resolved = resolveModel(model);
  if (resolved.provider === 'ollama') {
    return getUsage({ model: resolved.model, userId });
  }

  const usage = await getUsage({ model: resolved.model, userId });
  const wouldExceedTpm = estimatedTokens > 0
    && usage.used.tokensThisMinute + Number(estimatedTokens || 0) > usage.limits.tpm;

  if (
    usage.remaining.requestsThisMinute <= 0
    || usage.remaining.requestsToday <= 0
    || usage.remaining.userRequestsToday <= 0
    || wouldExceedTpm
  ) {
    throw createQuotaError(usage);
  }

  return usage;
}

async function logGeminiRequest(logData) {
  try {
    return await aiUsageModel.create(logData);
  } catch (err) {
    console.error('AI usage log failed:', err.message);
    return null;
  }
}

module.exports = {
  normalizeModel,
  resolveModel,
  getUsage,
  assertQuota,
  logGeminiRequest,
};
