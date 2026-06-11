const { GoogleGenAI } = require('@google/genai');
const aiProviders = require('./ai-providers');

const apiKey = process.env.GEMINI_API_KEY;
const modelName = aiProviders.gemini.defaultModel;
const allowedModels = aiProviders.gemini.allowedModels;
const limits = {
  rpm: Number(process.env.GEMINI_RPM_LIMIT || 5),
  tpm: Number(process.env.GEMINI_TPM_LIMIT || 250000),
  rpd: Number(process.env.GEMINI_RPD_LIMIT || 20),
  dailyUserRequests: Number(process.env.AI_DAILY_USER_REQUEST_LIMIT || 10),
};

const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

module.exports = { genAI, modelName, allowedModels, limits };
