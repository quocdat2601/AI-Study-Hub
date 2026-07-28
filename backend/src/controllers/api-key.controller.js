const { encrypt } = require('../utils/crypto.utils');
const { detectProvider, maskKey, validateGeminiKey } = require('../services/api-key-validation.service');
const UserApiKeyModel = require('../models/user-api-key.model');

/**
 * POST /api/keys/save
 * Body: { rawKey: string }
 * Detects provider, validates (Gemini only), encrypts, upserts to DB.
 */
async function saveKey(req, res, next) {
  try {
    const { rawKey } = req.body || {};
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return res.status(400).json({ error: 'rawKey is required.' });
    }

    const trimmedKey = rawKey.trim();
    const detected = detectProvider(trimmedKey);
    if (!detected) {
      return res.status(422).json({
        error: 'Could not detect the API provider from this key. Supported prefixes: AIza (Gemini), gsk_ (Groq), sk-ant- (Anthropic), sk- (OpenAI), xai- (Grok).',
      });
    }

    const { provider, label } = detected;
    let validationWarning = null;

    // Live validate Gemini keys; skip for others (no SDK installed)
    if (provider === 'gemini') {
      try {
        await validateGeminiKey(trimmedKey);
      } catch (valErr) {
        if (valErr.statusCode === 422) {
          return res.status(422).json({ error: valErr.publicMessage });
        }
        // statusCode === 0 means save-with-warning
        validationWarning = valErr.publicMessage;
      }
    }

    const encryptedPayload = encrypt(trimmedKey);
    const maskedKey = maskKey(trimmedKey);

    await UserApiKeyModel.upsert(req.user.id, provider, encryptedPayload, maskedKey);

    return res.status(200).json({
      provider,
      label,
      maskedKey,
      warning: validationWarning || null,
      message: validationWarning
        ? `Key saved with a warning: ${validationWarning}`
        : `${label} key saved and verified successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/keys
 * Returns the user's saved keys (masked values only).
 */
async function listKeys(req, res, next) {
  try {
    const keys = await UserApiKeyModel.findByUserId(req.user.id);
    return res.status(200).json({ keys });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/keys/:provider
 * Removes a saved key for the given provider.
 */
async function deleteKey(req, res, next) {
  try {
    const { provider } = req.params;
    if (!provider) {
      return res.status(400).json({ error: 'provider param is required.' });
    }
    await UserApiKeyModel.deleteByUserAndProvider(req.user.id, provider);
    return res.status(200).json({ message: `${provider} key removed.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { saveKey, listKeys, deleteKey };
