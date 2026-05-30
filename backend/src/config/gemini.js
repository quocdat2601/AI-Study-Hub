const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

module.exports = { genAI, modelName };
