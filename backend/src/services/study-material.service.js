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
  } catch (_err) {
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
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp mô phỏng tính năng Flashcards của NotebookLM.
Tạo đúng 10 thẻ ghi nhớ (flashcard) chất lượng cao từ nội dung tài liệu được cung cấp.

QUY TẮC BẮT BUỘC:
1. ĐỊNH DẠNG HỎI - ĐÁP (Q&A):
   - MẶT TRƯỚC (front): BẮT BUỘC phải là một câu hỏi trực tiếp và rõ ràng kiểm tra kiến thức về một khái niệm, sự kiện hoặc định lý trong tài liệu, kết thúc bằng dấu chấm hỏi (?). Tuyệt đối không được dùng câu khẳng định hoặc cụm từ chung chung.
   - MẶT SAU (back): Câu trả lời và giải thích trực tiếp, ngắn gọn cho câu hỏi ở mặt trước.
2. NGÔN NGỮ: BẮT BUỘC mặt trước và mặt sau phải được viết hoàn toàn bằng tiếng Việt tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên tiếng Anh (ví dụ: React, API, DNA). Tuyệt đối không để mặt trước tiếng Việt nhưng mặt sau lại dùng toàn bộ bằng tiếng Anh.
3. NGẮN GỌN & HIỆU QUẢ:
   - Mặt trước (front): Tối đa 25 từ.
   - Mặt sau (back): Tối đa 50 từ. Tránh các từ thừa như "đáp án là", "câu trả lời là".
4. Chỉ trả về JSON array thuần túy chứa các object có cấu trúc {"front": "...", "back": "..."}. Không có markdown, không có backtick, không giải thích gì thêm ngoài JSON.
5. Tuyệt đối KHÔNG tự động chèn hoặc giữ nguyên các ký tự đặc biệt hoặc thẻ giữ chỗ từ tài liệu nguồn nếu chúng không có nội dung thực tế (ví dụ: các chuỗi như "{question_id}", "{id}", "[insert image]").

VÍ DỤ FORMAT HỢP LỆ:
[
  {"front": "Vệ tinh tự nhiên duy nhất của Trái Đất tên là gì?", "back": "Mặt Trăng."},
  {"front": "Hiện tượng Trái Đất tự quay quanh trục sinh ra hệ quả gì?", "back": "Chu kỳ ngày và đêm liên tục trên bề mặt Trái Đất."}
]`;
      userPrompt += `Hãy tạo đúng 10 thẻ ghi nhớ (flashcards) dưới dạng các câu hỏi (front) và câu trả lời (back) bằng tiếng Việt từ tài liệu trên theo định dạng JSON yêu cầu. Tuyệt đối không chứa các thẻ giữ chỗ như "{question_id}".`;
    } else if (materialType === 'quiz') {
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp. Tạo đúng 5 câu hỏi trắc nghiệm từ nội dung tài liệu.

QUY TẮC BẮT BUỘC:
1. NGÔN NGỮ: BẮT BUỘC toàn bộ câu hỏi, các phương án lựa chọn (options) và phần giải thích (explanation) phải được viết bằng tiếng Việt tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên (ví dụ: React, API, DNA).
2. Mỗi câu có đúng 4 lựa chọn (A, B, C, D).
3. Trường "answer" phải là chuỗi KHỚP HOÀN TOÀN với một phần tử trong mảng "options".
4. "explanation" giải thích cụ thể lý do học thuật tại sao đáp án này đúng dựa trên thông tin thực tế từ tài liệu nguồn (tối đa 50 từ). TUYỆT ĐỐI KHÔNG dùng các câu chung chung, lặp lại hoặc rập khuôn (ví dụ: "Đây là câu trả lời chính xác dựa trên tài liệu học tập" hoặc "Giải thích chi tiết cho câu hỏi X...").
5. Chỉ trả về JSON array thuần túy, không có markdown.
6. Tuyệt đối KHÔNG tự động chèn hoặc giữ nguyên các ký tự đặc biệt hoặc thẻ giữ chỗ từ tài liệu nguồn nếu chúng không có nội dung thực tế (ví dụ: các chuỗi như "{question_id}", "{id}", "[insert image]").

FORMAT:
[
  {
    "question": "Câu hỏi trắc nghiệm?",
    "options": ["Đáp án đúng", "Sai 1", "Sai 2", "Sai 3"],
    "answer": "Đáp án đúng",
    "explanation": "Giải thích ngắn gọn."
  }
]`;
      userPrompt += `Hãy tạo đúng 5 câu hỏi trắc nghiệm bằng tiếng Việt từ tài liệu trên theo định dạng JSON yêu cầu. Đảm bảo toàn bộ câu hỏi, các phương án và phần giải thích (explanation) đều viết bằng tiếng Việt. Mỗi câu hỏi phải có phần giải thích độc nhất, mang tính học thuật cao và tuyệt đối không chứa các thẻ giữ chỗ như "{question_id}".`;
    } else if (materialType === 'mindmap') {
      systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp. Tạo một cấu trúc sơ đồ tư duy (mind map) phân cấp tóm tắt các khái niệm chính trong tài liệu.

QUY TẮC BẮT BUỘC:
1. NGÔN NGỮ: BẮT BUỘC tất cả các nhãn (label) phải được viết bằng tiếng Việt tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên tiếng Anh (ví dụ: React, API, DNA).
2. GIỚI HẠN ĐỘ SÂU: Chỉ tối đa 3 cấp (root → nhánh → lá). Không tạo nhánh sâu hơn.
3. Mỗi nút (label) tối đa 6 từ.
4. Root có 4-6 nhánh con trực tiếp.
5. Mỗi nhánh có 2-4 lá.
6. Chỉ trả về JSON object thuần túy, không có markdown.
7. Tuyệt đối KHÔNG tự động chèn hoặc giữ nguyên các ký tự đặc biệt hoặc thẻ giữ chỗ từ tài liệu nguồn nếu chúng không có nội dung thực tế (ví dụ: các chuỗi như "{question_id}", "{id}", "[insert image]").

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
      userPrompt += `Hãy tạo cấu trúc sơ đồ tư duy phân cấp bằng tiếng Việt từ tài liệu trên theo định dạng JSON yêu cầu. Tuyệt đối không chứa các thẻ giữ chỗ như "{question_id}".`;
    }

    // Estimate prompt tokens (characters / 4)
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    // Check usage limits if using Gemini
    if (selectedProvider === 'gemini') {
      await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
    }

    let responseText;
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
    if (materialType === 'flashcard') {
      if (!Array.isArray(content) || content.length === 0) {
        throw createError(500, 'AI did not return a valid list of flashcards');
      }
    }

    if (materialType === 'quiz') {
      if (!Array.isArray(content) || content.length === 0) {
        throw createError(500, 'AI did not return a valid quiz list');
      }
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

    let finalContent = content;
    if (materialType === 'mindmap') {
      // If wrapped in an array, unwrap it
      if (Array.isArray(finalContent) && finalContent.length > 0) {
        finalContent = finalContent[0];
      }
      // If wrapped in an outer object with a key like "mindmap" or "mind_map"
      if (finalContent && !finalContent.label && typeof finalContent === 'object') {
        if (finalContent.mindmap && finalContent.mindmap.label) {
          finalContent = finalContent.mindmap;
        } else if (finalContent.mind_map && finalContent.mind_map.label) {
          finalContent = finalContent.mind_map;
        } else {
          // If there is any single key inside that contains label
          const keys = Object.keys(finalContent);
          if (keys.length === 1 && finalContent[keys[0]] && finalContent[keys[0]].label) {
            finalContent = finalContent[keys[0]];
          }
        }
      }
      if (!finalContent || !finalContent.label) {
        throw createError(500, 'AI did not return a valid mind map structure');
      }
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
      content: finalContent,
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
