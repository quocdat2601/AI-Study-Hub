const StudyMaterialModel = require('../models/study-material.model');
const documentService = require('./document.service');
const aiUsageService = require('./ai-usage.service');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const aiService = require('./ai.service');
const documentTextService = require('./document-text.service');
const createError = require('../utils/createError');

function cleanAndParseJson(text) {
  let cleaned = String(text || '').trim();

  // Find first and last brackets or braces to isolate the JSON payload
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    // Looks like a JSON Array
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  } else if (firstBrace !== -1) {
    // Looks like a JSON Object
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  } else {
    // Fallback: Strip standard code blocks
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/```$/, '');
    cleaned = cleaned.trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse AI response as JSON. Original text:', text);
    throw createError(500, 'AI response was not in a valid JSON format. Please try again.');
  }
}

class StudyMaterialService {
  static async getMaterials({ docId, userId }) {
    const id = Number(docId);
    if (!Number.isInteger(id) || id <= 0) {
      throw createError(400, 'Document id is invalid');
    }
    // Verify document access
    const doc = await documentService.canUseDocumentInChat(userId, id);
    if (!doc) {
      throw createError(404, 'Document not found');
    }
    return StudyMaterialModel.findByDocAndUser(id, userId);
  }

  static async generateMaterial({ docId, userId, materialType, model }) {
    const id = Number(docId);
    if (!Number.isInteger(id) || id <= 0) {
      throw createError(400, 'Document id is invalid');
    }
    if (!['flashcard', 'quiz', 'mindmap'].includes(materialType)) {
      throw createError(400, 'Invalid material type');
    }

    // Verify document access
    const doc = await documentService.canUseDocumentInChat(userId, id);
    if (!doc) {
      throw createError(404, 'Document not found');
    }

    // Process document if text is not ready
    let text = String(doc.extracted_text || '').trim();
    if (!text || doc.extraction_status !== 'ready' || !documentTextService.isExtractedTextUseful(text)) {
      const procResult = await aiService.processDocument({
        id,
        userId,
        force: true,
      });
      text = String(procResult.document?.extracted_text || '').trim();
    }

    if (!text) {
      throw createError(400, 'No readable text available in this document');
    }

    // Truncate to save tokens and prevent LLM window overflow
    const maxChars = 15000;
    const truncatedText = text.length > maxChars ? text.slice(0, maxChars) + '...' : text;

    // Resolve model and provider
    const resolvedModel = aiUsageService.resolveModel(model);
    const selectedModel = resolvedModel.model;
    const selectedProvider = resolvedModel.provider;

    // Construct prompts
    let systemPrompt = '';
    let userPrompt = `Document content:\n${truncatedText}\n\n`;

    if (materialType === 'flashcard') {
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp. Tạo đúng 10 thẻ ghi nhớ (flashcard) từ nội dung tài liệu bên dưới.

QUY TẮC BẮT BUỘC:
1. NGÔN NGỮ: Toàn bộ nội dung phải bằng tiếng Việt. Tuyệt đối không dùng tiếng Anh, tiếng Trung hay ngôn ngữ khác.
2. MẶT TRƯỚC (front): Phải là một câu hỏi ngắn gọn, rõ ràng, kết thúc bằng dấu chấm hỏi (?). Tối đa 20 từ.
3. MẶT SAU (back): Câu trả lời trực tiếp, ngắn gọn. Tối đa 40 từ. Không dùng câu mở đầu như "Đây là..." hay "Câu trả lời là...".
4. Mỗi thẻ phải kiểm tra một khái niệm quan trọng, định nghĩa, hoặc sự kiện cụ thể từ tài liệu.
5. Chỉ trả về JSON array thuần túy, không có markdown, không có backtick.

VÍ DỤ FORMAT:
[
  {"front": "Định nghĩa của [khái niệm X] là gì?", "back": "Là [định nghĩa ngắn gọn bằng tiếng Việt]."},
  {"front": "[Y] được sử dụng để làm gì?", "back": "[Y] dùng để [mục đích chính]."}
]`;
      userPrompt += `Generate 10 flashcards from the text above in Vietnamese. Return JSON only.`;
    } else if (materialType === 'quiz') {
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp. Tạo đúng 5 câu hỏi trắc nghiệm từ nội dung tài liệu.

QUY TẮC BẮT BUỘC:
1. NGÔN NGỮ: Toàn bộ phải bằng tiếng Việt.
2. Mỗi câu có đúng 4 lựa chọn (A, B, C, D).
3. Trường "answer" phải là chuỗi KHỚP HOÀN TOÀN với một phần tử trong mảng "options".
4. "explanation" giải thích ngắn gọn tại sao đáp án đúng (tối đa 50 từ).
5. Chỉ trả về JSON array thuần túy, không có markdown.

FORMAT:
[
  {
    "question": "Câu hỏi trắc nghiệm?",
    "options": ["Đáp án đúng", "Sai 1", "Sai 2", "Sai 3"],
    "answer": "Đáp án đúng",
    "explanation": "Giải thích ngắn gọn."
  }
]`;
      userPrompt += `Generate 5 multiple choice questions from the text above in Vietnamese. Return JSON only.`;
    } else if (materialType === 'mindmap') {
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp. Tạo một cấu trúc sơ đồ tư duy (mind map) phân cấp tóm tắt các khái niệm chính trong tài liệu.

QUY TẮC BẮT BUỘC:
1. NGÔN NGỮ: Toàn bộ phải bằng tiếng Việt.
2. GIỚI HẠN ĐỘ SÂU: Chỉ tối đa 3 cấp (root → nhánh → lá). Không tạo nhánh sâu hơn.
3. Mỗi nút (label) tối đa 6 từ.
4. Root có 4-6 nhánh con trực tiếp.
5. Mỗi nhánh có 2-4 lá.
6. Chỉ trả về JSON object thuần túy, không có markdown.

FORMAT:
{
  "label": "Chủ đề chính",
  "children": [
    {
      "label": "Nhánh con 1",
      "children": [
        { "label": "Chi tiết chính 1", "children": [] },
        { "label": "Chi tiết chính 2", "children": [] }
      ]
    }
  ]
}`;
      userPrompt += `Generate a hierarchical mind map JSON structure from the text above in Vietnamese. Return JSON only.`;
    }

    // Estimate prompt tokens (characters / 4)
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    // Check usage limits if using Gemini
    if (selectedProvider === 'gemini') {
      await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
    }

    let responseText = '';
    let usageMetadata = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      // Call AI provider
      if (selectedProvider === 'ollama') {
        const result = await ollamaService.generateChat({
          model: selectedModel,
          systemPrompt,
          userPrompt,
        });
        responseText = result.text;
        usageMetadata = result.usageMetadata || usageMetadata;
      } else {
        const result = await geminiService.queryDocumentChunks({
          model: selectedModel,
          systemPrompt,
          userPrompt,
        });
        responseText = result.text;
        usageMetadata = result.usageMetadata || usageMetadata;
      }
    } catch (err) {
      console.error('Study material generation AI error:', err);
      
      const errMsg = String(err.message || '').toLowerCase();
      if (errMsg.includes('api key not valid') || errMsg.includes('key not valid') || errMsg.includes('api key')) {
        const customErr = createError(400, 'Gemini API key is invalid or placeholder is used in backend/.env');
        customErr.publicMessage = 'Yêu cầu AI thất bại: API Key của Gemini không hợp lệ hoặc chưa được cấu hình đúng trong file backend/.env';
        throw customErr;
      }
      
      if (errMsg.includes('connect to the remote server') || errMsg.includes('connection refused') || errMsg.includes('fetch failed')) {
        const customErr = createError(400, 'Unable to connect to Ollama local server');
        customErr.publicMessage = 'Yêu cầu AI thất bại: Không thể kết nối với dịch vụ Ollama cục bộ. Vui lòng đảm bảo Ollama đang chạy.';
        throw customErr;
      }

      const status = err.statusCode || 500;
      const customErr = createError(status, err.message || 'AI request failed');
      customErr.publicMessage = err.publicMessage || 'Yêu cầu AI thất bại: Vui lòng kiểm tra lại cấu hình mô hình hoặc thử lại sau.';
      throw customErr;
    }

    // Record AI request log
    if (selectedProvider === 'gemini') {
      await aiUsageService.logGeminiRequest({
        userId,
        model: selectedModel,
        promptTokens: usageMetadata.promptTokens || estimatedTokens,
        completionTokens: usageMetadata.completionTokens || 0,
        totalTokens: usageMetadata.totalTokens || (estimatedTokens + (usageMetadata.completionTokens || 0)),
      });
    }

    // Parse and validate content JSON
    const content = cleanAndParseJson(responseText);

    // Enforce basic schema validation
    if (materialType === 'flashcard' && (!Array.isArray(content) || content.length === 0)) {
      throw createError(500, 'AI did not return a valid list of flashcards');
    }
    if (materialType === 'quiz' && (!Array.isArray(content) || content.length === 0)) {
      throw createError(500, 'AI did not return a valid quiz list');
    }
    if (materialType === 'quiz') {
      content.forEach((q, i) => {
        const match = (q.options || []).find(
          opt => opt.trim().toLowerCase() === (q.answer || '').trim().toLowerCase()
        );
        if (!match) {
          console.warn(`Quiz Q${i+1}: answer "${q.answer}" not found in options. Defaulting to first option.`);
          q.answer = q.options?.[0] || q.answer;
        }
      });
    }
    if (materialType === 'mindmap' && (!content.label)) {
      throw createError(500, 'AI did not return a valid mind map structure');
    }

    // Determine a neat title
    let title = '';
    if (materialType === 'flashcard') {
      title = `${doc.title} Flashcards`;
    } else if (materialType === 'quiz') {
      title = `${doc.title} Quiz`;
    } else if (materialType === 'mindmap') {
      title = `${doc.title} Mind Map`;
    }

    // Persist to database
    const saved = await StudyMaterialModel.create({
      doc_id: id,
      user_id: userId,
      material_type: materialType,
      title,
      content,
    });

    return saved;
  }

  static async deleteMaterial({ materialId, userId }) {
    const result = await StudyMaterialModel.deleteById({ materialId, userId });
    if (!result) {
      throw createError(404, 'Study material not found');
    }
    return { success: true };
  }
}

module.exports = StudyMaterialService;
