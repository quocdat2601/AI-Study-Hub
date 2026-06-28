const geminiService = require('./gemini.service');
const tagModel = require('../models/tag.model');
const aiUsageService = require('./ai-usage.service');

function parseTagArray(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((t) => String(t));
  } catch {
    // Model có thể trả chuỗi phân tách dấu phẩy thay vì JSON — vẫn dùng được
  }
  return text ? text.split(/[,\n]/) : [];
}

/**
 * Sinh và gắn tag tự động cho tài liệu. Best-effort: lỗi không làm hỏng upload.
 * Trả về mảng tên tag đã gắn, hoặc [] nếu bỏ qua/không sinh được.
 */
async function autoTagDocument({ userId, docId, title, text }) {
  const snippet = String(text || '').trim();
  if (!snippet) return [];

  let result;
  try {
    const knownTags = (await tagModel.topByUsageNames(50)) || [];
    result = await geminiService.generateTags({ title, text: snippet, knownTags });

    await aiUsageService.logGeminiRequest({
      userId,
      docId,
      provider: 'gemini',
      model: result.model,
      requestType: 'auto_tag',
      promptTokens: result.usageMetadata?.promptTokens,
      completionTokens: result.usageMetadata?.completionTokens,
      totalTokens: result.usageMetadata?.totalTokens,
      success: true,
    });
  } catch (err) {
    console.error('Auto-tag generation failed:', err.message);
    return [];
  }

  const names = tagModel.parseNames(parseTagArray(result.text).join(','));
  if (!names.length) return [];

  await tagModel.setForDocument(docId, names.join(','));
  return names;
}

module.exports = { autoTagDocument };
