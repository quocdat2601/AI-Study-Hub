/**
 * API Key validation service.
 * - Detects provider from key prefix.
 * - Validates Gemini keys by making a cheap test call.
 * - Non-Gemini keys are accepted without live validation (stored with a warning).
 */
const { GoogleGenAI } = require('@google/genai');

const PROVIDER_PATTERNS = [
  { pattern: /^sk-ant-/, provider: 'anthropic', label: 'Anthropic (Claude)' },
  { pattern: /^sk-proj-/, provider: 'openai', label: 'OpenAI' },
  { pattern: /^sk-[^a]/i, provider: 'openai', label: 'OpenAI' },
  { pattern: /^AIza/, provider: 'gemini', label: 'Google Gemini' },
  { pattern: /^gsk_/, provider: 'groq', label: 'Groq' },
  { pattern: /^xai-/, provider: 'grok', label: 'xAI Grok' },
];

/**
 * Detect the provider from the raw key string.
 * @param {string} rawKey
 * @returns {{ provider: string, label: string } | null}
 */
function detectProvider(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  for (const { pattern, provider, label } of PROVIDER_PATTERNS) {
    if (pattern.test(trimmed)) return { provider, label };
  }
  return null;
}

/**
 * Build the masked key string (e.g. "AIza****abcd").
 * Shows first 4 chars and last 4 chars.
 */
function maskKey(rawKey) {
  const k = rawKey.trim();
  if (k.length <= 8) return '****';
  return `${k.slice(0, 4)}****${k.slice(-4)}`;
}

/**
 * Validate a Gemini key by making a minimal 1-token test call.
 * Throws if the key is invalid or the call fails.
 */
async function validateGeminiKey(rawKey) {
  const testClient = new GoogleGenAI({ apiKey: rawKey.trim() });
  try {
    await testClient.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: 'Say: ok',
      config: { maxOutputTokens: 3 },
    });
  } catch (err) {
    // Surface auth errors clearly
    const message = err?.message || String(err);
    if (message.includes('API_KEY_INVALID') || message.includes('INVALID_ARGUMENT') || message.includes('401') || message.includes('403')) {
      const apiErr = new Error('Gemini API key is invalid or does not have the required permissions.');
      apiErr.publicMessage = 'The Gemini API key is invalid. Please check and try again.';
      apiErr.statusCode = 422;
      throw apiErr;
    }
    // Network / quota errors — key may be valid, just warn
    const apiErr = new Error(`Gemini key validation call failed: ${message}`);
    apiErr.publicMessage = 'Could not validate the Gemini key right now (network or quota issue). The key was saved anyway.';
    apiErr.statusCode = 0; // Signal: save but warn
    throw apiErr;
  }
}

module.exports = { detectProvider, maskKey, validateGeminiKey };
