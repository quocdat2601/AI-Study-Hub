const StudyMaterialModel = require('../models/study-material.model');
const DocumentChunkModel = require('../models/document-chunk.model');
const documentService = require('./document.service');
const aiUsageService = require('./ai-usage.service');
const geminiService = require('./gemini.service');
const ollamaService = require('./ollama.service');
const aiService = require('./ai.service');
const documentTextService = require('./document-text.service');
const ragService = require('./rag.service');
const createError = require('../utils/createError');

function cleanAndParseJson(text) {
  let cleaned = String(text || '').trim();
  if (!cleaned) {
    const err = createError(500, 'AI response was not in a valid JSON format. Please try again.');
    err.publicMessage = 'Phản hồi AI trống hoặc không hợp lệ. Hãy thử lại hoặc chọn mô hình Gemini.';
    throw err;
  }

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    cleaned = fencedMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/g, '');
    cleaned = cleaned.trim();
  }

  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  cleaned = cleaned.trim();

  // Strip trailing commas before ] or } (common with local models)
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  }

  const candidates = [
    cleaned,
    cleaned.replace(/,\s*([}\]])/g, '$1'),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_err) {
      // try next cleanup strategy
    }
  }

  throw createError(500, 'AI response was not in a valid JSON format. Please try again.');
}

function salvageTruncatedJson(text) {
  let s = String(text || '').trim();
  const objStart = s.indexOf('{');
  const arrStart = s.indexOf('[');
  let start = -1;
  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) start = objStart;
  else if (arrStart !== -1) start = arrStart;
  if (start > 0) s = s.slice(start);

  s = s.replace(/,\s*"[^"]*"?\s*:\s*("[^"]*)?$/, '');
  s = s.replace(/,\s*"[^"]*"?\s*:\s*(\[[^\]]*)?$/, '');
  s = s.replace(/,\s*$/, '');

  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/,\s*([}\]])/g, '$1');
  }

  const openCurly = (s.match(/{/g) || []).length;
  const closeCurly = (s.match(/}/g) || []).length;
  const openSquare = (s.match(/\[/g) || []).length;
  const closeSquare = (s.match(/]/g) || []).length;

  s += ']'.repeat(Math.max(0, openSquare - closeSquare));
  s += '}'.repeat(Math.max(0, openCurly - closeCurly));
  return s;
}

function parseJsonLenient(text) {
  try {
    return cleanAndParseJson(text);
  } catch (_first) {
    try {
      return cleanAndParseJson(salvageTruncatedJson(text));
    } catch (_second) {
      return null;
    }
  }
}

function cleanAndParseJsonStrict(text) {
  const parsed = parseJsonLenient(text);
  if (parsed === null) {
    console.error('Failed to parse AI response as JSON. Original text:', text);
    const err = createError(500, 'AI response was not in a valid JSON format. Please try again.');
    err.publicMessage = 'Phản hồi AI không đúng định dạng JSON. Hãy thử lại hoặc chọn mô hình Gemini nếu lỗi tiếp tục.';
    throw err;
  }
  return parsed;
}

function normalizeArrayContent(parsed, materialType) {
  let content = parsed;

  if (Array.isArray(content)) {
    return content;
  }

  if (content && typeof content === 'object') {
    const preferredKeys = materialType === 'flashcard'
      ? ['flashcards', 'cards', 'flash_cards', 'items', 'data', 'results']
      : ['quiz', 'questions', 'question', 'items', 'data', 'results'];

    for (const key of preferredKeys) {
      if (Array.isArray(content[key]) && content[key].length > 0) {
        return content[key];
      }
    }

    if (materialType === 'flashcard' && (content.front || content.question || content.Q || content.q)) {
      return [content];
    }

    if (materialType === 'quiz' && content.question && !Array.isArray(content.question)) {
      return [content];
    }

    for (const value of Object.values(content)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        return value;
      }
    }

    const keys = Object.keys(content);
    if (keys.length === 1 && Array.isArray(content[keys[0]])) {
      return content[keys[0]];
    }
  }

  return content;
}

const MAX_BACK_WORDS = 25;

function truncateToWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length <= maxWords) return String(text || '').trim();
  // Find a natural break point — stop at last complete sentence within limit
  const truncated = words.slice(0, maxWords).join(' ');
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > truncated.length * 0.5) {
    return truncated.slice(0, lastPeriod + 1); // cut at sentence boundary
  }
  return truncated + '.';
}

function isBackComplete(text) {
  const t = text.trim();
  if (!t) return false;
  // Complete if ends with sentence-ending punctuation
  return /[.!?。…]$/.test(t);
}

function normalizeFlashcardItems(items) {
  return items
    .map((item) => ({
      front: String(
        item?.front || item?.question || item?.q || item?.Q || item?.term || item?.prompt || item?.title || ''
      ).trim(),
      back: truncateToWords(
        item?.back || item?.answer || item?.a || item?.A || item?.definition || item?.response || item?.reply || item?.meaning || '',
        MAX_BACK_WORDS
      ),
    }))
    .filter((item) => {
      if (!item.front) return false;
      const cleanBack = item.back.replace(/[…\.]+/g, '').trim();
      if (cleanBack.length <= 1) return false;
      // ADD: reject backs that look mid-sentence (end with a conjunction or preposition)
      const midSentenceEndings = /\b(và|hoặc|là|của|để|cho|với|trong|từ|đến|bằng|qua|về|như|mà|hay|khi|tại|theo|vì|do|nên|thì|nhưng|còn|vẫn|đang|sẽ|đã|làm|có|được|bị|các|những|một|này|đó)\.?$/i;
      if (midSentenceEndings.test(item.back.trim())) return false;
      return true;
    });
}

function stripOptionPrefix(text) {
  return String(text || '').trim().replace(/^[A-Da-d][.)]\s*/, '');
}

function normalizeQuizOptionsFromItem(item) {
  if (Array.isArray(item?.options)) {
    return item.options
      .map((opt) => {
        if (typeof opt === 'string') return stripOptionPrefix(opt);
        if (opt && typeof opt === 'object') {
          return stripOptionPrefix(String(opt.text || opt.label || opt.option || opt.value || ''));
        }
        return stripOptionPrefix(String(opt || ''));
      })
      .filter(Boolean);
  }

  if (item?.options && typeof item.options === 'object') {
    return Object.entries(item.options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => stripOptionPrefix(String(value)))
      .filter(Boolean);
  }

  if (Array.isArray(item?.choices)) {
    return item.choices
      .map((opt) => stripOptionPrefix(typeof opt === 'string' ? opt : String(opt?.text || opt?.label || opt?.option || '')))
      .filter(Boolean);
  }

  if (Array.isArray(item?.answers) || Array.isArray(item?.alternatives)) {
    const source = item.answers || item.alternatives;
    return source
      .map((opt) => stripOptionPrefix(typeof opt === 'string' ? opt : String(opt?.text || opt?.label || opt?.option || '')))
      .filter(Boolean);
  }

  const letterOptions = ['A', 'B', 'C', 'D', 'E']
    .map((letter) => item?.[letter] ?? item?.[letter.toLowerCase()])
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => stripOptionPrefix(String(value)));

  if (letterOptions.length >= 2) return letterOptions;

  const suffixedOptions = ['a', 'b', 'c', 'd', 'e']
    .map((letter) => item?.[`option_${letter}`] ?? item?.[`option${letter.toUpperCase()}`] ?? item?.[`choice_${letter}`])
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => stripOptionPrefix(String(value)));

  if (suffixedOptions.length >= 2) return suffixedOptions;

  if (typeof item?.options === 'string') {
    return item.options
      .split(/\n|;|\|/)
      .map((part) => stripOptionPrefix(part))
      .filter(Boolean);
  }

  return [];
}

function getRawQuizAnswer(item) {
  const fields = [
    'answer',
    'correct_answer',
    'correctAnswer',
    'correct_option',
    'correctOption',
    'correct',
    'solution',
  ];

  for (const field of fields) {
    const value = item?.[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }

  if (item?.answer_index !== undefined && item?.answer_index !== null) return item.answer_index;
  if (item?.correctIndex !== undefined && item?.correctIndex !== null) return item.correctIndex;
  if (item?.correct_index !== undefined && item?.correct_index !== null) return item.correct_index;

  return '';
}

function normalizeQuizText(value) {
  return stripOptionPrefix(String(value || '')).trim().toLowerCase();
}

function isQuizPlaceholderText(text) {
  const normalized = normalizeQuizText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
  if (!normalized) return true;
  if (/^(?:sai|wrong|incorrect)\s*\d+$/.test(normalized)) return true;
  if (/^(?:phuong an|option|choice)\s*[a-d]$/.test(normalized)) return true;
  if (/^(?:dap an dung|dung|correct answer|correct option)$/.test(normalized)) return true;
  return false;
}

function hasQuizPlaceholderOptions(options) {
  return (options || []).some((opt) => isQuizPlaceholderText(opt));
}

function resolveQuizAnswer(options, rawAnswer) {
  if (!Array.isArray(options) || options.length === 0) return '';
  const answer = String(rawAnswer ?? '').trim();
  if (!answer) return '';

  const exact = options.find((opt) => normalizeQuizText(opt) === normalizeQuizText(answer));
  if (exact) return exact;

  const letterOnly = answer.match(/^([A-Da-d])[.)]?\s*$/);
  if (letterOnly) {
    const idx = letterOnly[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return options[idx];
  }

  const letterWithText = answer.match(/^([A-Da-d])[.)]\s*(.+)$/);
  if (letterWithText) {
    const idx = letterWithText[1].toUpperCase().charCodeAt(0) - 65;
    const rest = normalizeQuizText(letterWithText[2]);
    const byLetter = idx >= 0 && idx < options.length ? options[idx] : '';
    if (byLetter && normalizeQuizText(byLetter) === rest) return byLetter;
    if (byLetter) return byLetter;
  }

  if (/^\d+$/.test(answer)) {
    const num = Number(answer);
    if (num >= 1 && num <= options.length) return options[num - 1];
    if (num >= 0 && num < options.length) return options[num];
  }

  const fuzzy = options.find((opt) => {
    const normalizedOption = normalizeQuizText(opt);
    const normalizedAnswer = normalizeQuizText(answer);
    return normalizedOption
      && (normalizedAnswer.includes(normalizedOption) || normalizedOption.includes(normalizedAnswer));
  });
  if (fuzzy) return fuzzy;

  return '';
}

function alignQuizAnswerWithExplanation(question) {
  const explanation = normalizeQuizText(question.explanation);
  if (!explanation || !Array.isArray(question.options) || question.options.length < 2) {
    return question;
  }

  let bestOption = null;
  let bestScore = 0;
  for (const option of question.options) {
    const normalizedOption = normalizeQuizText(option);
    if (!normalizedOption) continue;

    let score = 0;
    if (explanation.includes(normalizedOption)) {
      score = normalizedOption.length;
    } else if (normalizedOption.length >= 12 && explanation.includes(normalizedOption.slice(0, 12))) {
      score = 12;
    }

    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  if (!bestOption) return question;

  const currentAnswer = normalizeQuizText(question.answer);
  const bestAnswer = normalizeQuizText(bestOption);

  if (!currentAnswer) {
    question.answer = bestOption;
    return question;
  }

  const currentInExplanation = explanation.includes(currentAnswer);
  const bestInExplanation = explanation.includes(bestAnswer);

  if (bestInExplanation && !currentInExplanation && bestAnswer !== currentAnswer) {
    console.warn(`Quiz answer realigned from "${question.answer}" to "${bestOption}" based on explanation match`);
    question.answer = bestOption;
  }

  return question;
}

function finalizeQuizItem(item, rawItem) {
  if (!item.question) return null;

  let options = Array.isArray(item.options) ? [...item.options] : [];
  if (options.length === 1 && typeof options[0] === 'string' && options[0].includes('\n')) {
    options = options[0]
      .split(/\n/)
      .map((part) => stripOptionPrefix(part))
      .filter(Boolean);
  }

  if (options.length < 2) return null;
  if (hasQuizPlaceholderOptions(options)) {
    console.warn(`Quiz rejected: placeholder options in "${item.question.slice(0, 60)}"`);
    return null;
  }

  const normalizedItem = {
    question: item.question,
    options,
    answer: item.answer,
    explanation: item.explanation,
  };

  if (!normalizedItem.answer && rawItem) {
    normalizedItem.answer = resolveQuizAnswer(options, getRawQuizAnswer(rawItem));
  }

  if (!normalizedItem.answer && normalizedItem.explanation) {
    alignQuizAnswerWithExplanation(normalizedItem);
  }

  let match = normalizedItem.options.find(
    (opt) => normalizeQuizText(opt) === normalizeQuizText(normalizedItem.answer)
  );

  if (!match && rawItem) {
    const retryAnswer = resolveQuizAnswer(normalizedItem.options, getRawQuizAnswer(rawItem));
    if (retryAnswer) {
      normalizedItem.answer = retryAnswer;
      match = retryAnswer;
    }
  }

  if (!match && normalizedItem.explanation) {
    alignQuizAnswerWithExplanation(normalizedItem);
    match = normalizedItem.options.find(
      (opt) => normalizeQuizText(opt) === normalizeQuizText(normalizedItem.answer)
    );
  }

  if (!match) return null;

  return {
    question: normalizedItem.question,
    options: normalizedItem.options,
    answer: match,
    explanation: normalizedItem.explanation,
  };
}

function normalizeQuizItems(items) {
  return items
    .map((item) => {
      const options = normalizeQuizOptionsFromItem(item);
      const rawAnswer = getRawQuizAnswer(item);
      const resolvedAnswer = resolveQuizAnswer(options, rawAnswer);

      return finalizeQuizItem(
        {
          question: String(item?.question || item?.q || item?.text || item?.stem || '').trim(),
          options,
          answer: resolvedAnswer,
          explanation: String(item?.explanation || item?.explain || item?.reason || '').trim(),
        },
        item
      );
    })
    .filter(Boolean);
}

const MATERIAL_TARGETS = {
  flashcard: 10,
  quiz: 5,
};

const OLLAMA_BATCH_SIZE = {
  flashcard: 1,
  quiz: 1,
};

const OLLAMA_MAX_BATCH_ATTEMPTS = {
  flashcard: 40,
  quiz: 40,
};

const GEMINI_MATERIAL_MAX_CHARS = 15000;
const MATERIAL_CHUNK_WINDOW_CHARS = 1800;

const QUIZ_JSON_EXAMPLE = `{
  "question": "Thời kỳ nào phương thức sản xuất tư bản hình thành ở Anh?",
  "options": [
    "Cuối thế kỷ XVIII – đầu thế kỷ XIX",
    "Giữa thế kỷ XVI ở Tây Ban Nha",
    "Đầu thế kỷ XX ở Mỹ",
    "Thời Trung cổ ở châu Âu"
  ],
  "answer": "Cuối thế kỷ XVIII – đầu thế kỷ XIX",
  "explanation": "Cách mạng công nghiệp đánh dấu sự hình thành PSTS tư bản."
}`;

function assertMaterialTargetCount(content, materialType, { provider, model }) {
  const target = MATERIAL_TARGETS[materialType];
  if (!target || content.length >= target) return;

  const label = materialType === 'flashcard' ? 'thẻ ghi nhớ' : 'câu hỏi trắc nghiệm';
  console.error(
    `${materialType} incomplete: got ${content.length}/${target}. Provider=${provider}, model=${model}`
  );
  const err = createError(
    500,
    materialType === 'flashcard'
      ? `AI returned ${content.length} flashcards but ${target} are required`
      : `AI returned ${content.length} quiz questions but ${target} are required`
  );
  err.publicMessage = `Chỉ tạo được ${content.length}/${target} ${label}. Hãy thử lại hoặc chọn mô hình Gemini để đạt đủ số lượng.`;
  throw err;
}

function normalizeDedupeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// Two keys are "similar" if they are identical, or one is a leading substring of the other
// (covers "X được đề xuất?" vs "X được đề xuất trong dự án?").
// The min-length guard (5 words) prevents false positives on short generic keys.
function isSimilarKey(a, b) {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 20) return false; // too short to be meaningful
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return longer.startsWith(shorter);
}

function isKnownMaterialFront(front, mergedItems) {
  const key = normalizeDedupeText(front);
  return mergedItems.some((item) => isSimilarKey(normalizeDedupeText(item.front), key));
}

function isKnownQuizQuestion(question, mergedItems) {
  const key = normalizeDedupeText(question);
  return mergedItems.some((item) => isSimilarKey(normalizeDedupeText(item.question), key));
}

function dedupeMaterialItems(items, materialType) {
  const seen = [];
  return items.filter((item) => {
    const raw = materialType === 'flashcard' ? item.front : item.question;
    const key = normalizeDedupeText(raw);
    if (!key || seen.some((s) => isSimilarKey(s, key))) return false;
    seen.push(key);
    return true;
  });
}

function unescapeJsonString(value) {
  return String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function extractFlashcardsFromLooseText(text) {
  const results = [];
  const pattern = /"(?:front|Front|question|Q|q)"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"(?:back|Back|answer|A|a)"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
  let match = pattern.exec(text);
  while (match) {
    results.push({
      front: unescapeJsonString(match[1]),
      back: unescapeJsonString(match[2]),
    });
    match = pattern.exec(text);
  }
  return normalizeFlashcardItems(results);
}

function extractPartialFlashcardFront(text) {
  const parsed = parseJsonLenient(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const front = String(
      parsed.front || parsed.question || parsed.Q || parsed.q || ''
    ).trim();
    const back = String(
      parsed.back || parsed.answer || parsed.A || parsed.a || ''
    ).trim();
    if (front && !back) return front;
  }

  const frontMatch = String(text || '').match(/"front"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (frontMatch && !/"back"\s*:/i.test(text)) {
    return unescapeJsonString(frontMatch[1]);
  }

  return null;
}

async function repairFlashcardBack({ front, batchText, callMaterialAi }) {
  const repairSystemPrompt = `Bạn là trợ lý học tập. Trả về JSON duy nhất {"back":"..."} — câu trả lời ngắn (tối đa 20 từ) bằng tiếng Việt cho câu hỏi đã cho, dựa trên tài liệu. Không markdown, không giải thích.`;
  const userPrompt = `Câu hỏi flashcard:\n${front}\n\nTài liệu:\n${batchText}\n\nTrả về {"back":"..."} duy nhất.`;

  try {
    const result = await callMaterialAi({
      batchSystemPrompt: repairSystemPrompt,
      batchUserPrompt: userPrompt,
      temperature: 0.2,
    });
    const parsed = parseJsonLenient(result.text);
    if (parsed && typeof parsed === 'object') {
      const back = String(parsed.back || parsed.answer || parsed.A || parsed.a || '').trim();
      if (back) return { front, back };
    }
    const backMatch = String(result.text || '').match(/"back"\s*:\s*"((?:\\.|[^"\\])*)"/i);
    if (backMatch) {
      return { front, back: unescapeJsonString(backMatch[1]) };
    }
  } catch (_err) {
    // repair is best-effort
  }
  return null;
}

function enforceTargetCount(items, materialType) {
  const target = MATERIAL_TARGETS[materialType];
  if (!target) return items;
  return items.slice(0, target);
}

function buildMaterialPrompts({ materialType, documentContext, count }) {
  const documentBlock = `Document content:\n${documentContext}\n\n`;

  if (materialType === 'flashcard') {
    const singleObjectFormat = count === 1;
    const formatBlock = singleObjectFormat
      ? `FORMAT (một thẻ duy nhất — trả về JSON OBJECT, KHÔNG phải array):
{"front": "Câu hỏi?", "back": "Câu trả lời."}

BẮT BUỘC: JSON phải có CẢ HAI khóa "front" VÀ "back". Chỉ trả "front" mà thiếu "back" là KHÔNG HỢP LỆ.
- front: tối đa 12 từ, kết thúc bằng dấu ?
- back: tối đa 12 từ, câu HOÀN CHỈNH, không bị cắt giữa chừng`
      : `VÍ DỤ FORMAT HỢP LỆ:
[
  {"front": "Vệ tinh tự nhiên duy nhất của Trái Đất tên là gì?", "back": "Mặt Trăng."},
  {"front": "Hiện tượng Trái Đất tự quay quanh trục sinh ra hệ quả gì?", "back": "Chu kỳ ngày và đêm liên tục."}
]`;

    const systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp cho AI Study Hub. TOÀN BỘ NỘI DUNG BẠN TẠO PHẢI BẰNG TIẾNG VIỆT HOÀN TOÀN, KHÔNG ĐƯỢC DÙNG TIẾNG ANH, TRUNG HAY NGÔN NGỮ NÀO KHÁC NGOẠI TRỪ CÁC THUẬT NGỮ KỸ THUẬT CHUYÊN NGÀNH HOẶC TÊN RIÊNG (như React, API, DNA).

Tạo đúng ${count} thẻ ghi nhớ (flashcard) chất lượng cao từ nội dung tài liệu được cung cấp.

QUY TẮC BẮT BUỘC NHẤT NHẤT:
1. ĐỊNH DẠNG HỎI - ĐÁP (Q&A):
   - MẶT TRƯỚC (front): BẮT BUỘC phải là một câu hỏi trực tiếp và rõ ràng bằng TIẾNG VIỆT, kiểm tra kiến thức về một khái niệm, sự kiện hoặc định lý trong tài liệu, kết thúc bằng dấu chấm hỏi (?). Tuyệt đối không được dùng câu khẳng định hoặc cụm từ chung chung.
   - MẶT SAU (back): Câu trả lời và giải thích trực tiếp, ngắn gọn BẰNG TIẾNG VIỆT cho câu hỏi ở mặt trước.
2. NGÔN NGỮ: BẮT BUỘC mặt trước và mặt sau phải được viết hoàn toàn bằng tiếng Việt tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên tiếng Anh (ví dụ: React, API, DNA). Tuyệt đối không để mặt trước tiếng Việt nhưng mặt sau lại dùng toàn bộ bằng tiếng Anh.
3. NGẮN GỌN & HIỆU QUẢ:
   - Mặt trước (front): Tối đa 15 từ.
   - Mặt sau (back): Tối đa 12 từ. Câu trả lời phải HOÀN CHỈNH, không bị cắt giữa chừng. Ưu tiên câu ngắn và đầy đủ ý hơn câu dài bị cụt. Tránh các từ thừa như "đáp án là", "câu trả lời là".
4. CHỈ TRẢ VỀ JSON THUẦN TÚY: Dùng đúng khóa "front" và "back" (KHÔNG dùng Q/A). Không markdown, không backtick, không lời dẫn.
5. Tuyệt đối KHÔNG tự động chèn hoặc giữ nguyên các thẻ giữ chỗ từ tài liệu nguồn.

${formatBlock}`;
    const jsonShapeHint = singleObjectFormat
      ? 'CHỈ TRẢ VỀ MỘT JSON OBJECT (không bọc trong array).'
      : 'CHỈ TRẢ VỀ JSON ARRAY, KHÔNG GÌ KHÁC.';
    const userPrompt = `${documentBlock}Hãy tạo đúng ${count} thẻ ghi nhớ (flashcards) dưới dạng các câu hỏi (front) và câu trả lời (back) HOÀN TOÀN bằng tiếng Việt từ tài liệu trên. ${jsonShapeHint} Tuyệt đối không chứa các thẻ giữ chỗ như "{question_id}".`;
    return { systemPrompt, userPrompt };
  }

  if (materialType === 'quiz') {
    const singleObjectFormat = count === 1;
    const formatBlock = singleObjectFormat
      ? `FORMAT (một câu duy nhất — trả về JSON OBJECT, KHÔNG phải array):
${QUIZ_JSON_EXAMPLE}`
      : `FORMAT:
[
  ${QUIZ_JSON_EXAMPLE.replace(/\n/g, '\n  ')}
]`;

    const systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp cho AI Study Hub. TOÀN BỘ NỘI DUNG BẠN TẠO PHẢI BẰNG TIẾNG VIỆT HOÀN TOÀN, KHÔNG ĐƯỢC DÙNG TIẾNG ANH, TRUNG HAY NGÔN NGỮ NÀO KHÁC NGOẠI TRỪ CÁC THUẬT NGỮ KỸ THUẬT CHUYÊN NGÀNH HOẶC TÊN RIÊNG (như React, API, DNA).

Tạo đúng ${count} câu hỏi trắc nghiệm từ nội dung tài liệu.

QUY TẮC BẮT BUỘC NHẤT NHẤT:
1. NGÔN NGỮ: BẮT BUỘC toàn bộ câu hỏi, các phương án lựa chọn (options) và phần giải thích (explanation) phải được viết BẰNG TIẾNG VIỆT tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên (ví dụ: React, API, DNA).
2. Mỗi câu có đúng 4 phương án CỤ THỂ từ tài liệu. TUYỆT ĐỐI KHÔNG dùng "Sai 1", "Sai 2", "Sai 3", "Đáp án đúng" hay bất kỳ placeholder nào — mỗi option phải là câu trả lời thật.
3. Trường "answer" BẮT BUỘC phải là chuỗi văn bản TRÙNG KHỚP 100% với một phần tử trong mảng "options". TUYỆT ĐỐI KHÔNG chỉ ghi A, B, C, D hay số thứ tự.
4. "explanation" phải mô tả đúng đáp án đã chọn trong "answer", dựa trên thông tin thực tế từ tài liệu nguồn (tối đa 50 từ).
5. CHỈ TRẢ VỀ JSON THUẦN TÚY, KHÔNG GÌ KHÁC: Không markdown, không backtick, không lời dẫn.
6. Tuyệt đối KHÔNG tự động chèn hoặc giữ nguyên các thẻ giữ chỗ từ tài liệu nguồn.

${formatBlock}`;
    const jsonShapeHint = singleObjectFormat
      ? 'CHỈ TRẢ VỀ MỘT JSON OBJECT (không bọc trong array).'
      : 'CHỈ TRẢ VỀ JSON ARRAY, KHÔNG GÌ KHÁC.';
    const userPrompt = `${documentBlock}Hãy tạo đúng ${count} câu hỏi trắc nghiệm HOÀN TOÀN bằng tiếng Việt từ tài liệu trên. ${jsonShapeHint} Trường "answer" phải là nguyên văn một phần tử trong "options".`;
    return { systemPrompt, userPrompt };
  }

  const systemPrompt = `Bạn là trợ lý học tập chuyên nghiệp cho AI Study Hub. TOÀN BỘ NỘI DUNG BẠN TẠO PHẢI BẰNG TIẾNG VIỆT HOÀN TOÀN, KHÔNG ĐƯỢC DÙNG TIẾNG ANH, TRUNG HAY NGÔN NGỮ NÀO KHÁC NGOẠI TRỪ CÁC THUẬT NGỮ KỸ THUẬT CHUYÊN NGÀNH HOẶC TÊN RIÊNG (như React, API, DNA).

Tạo một cấu trúc sơ đồ tư duy (mind map) phân cấp tóm tắt các khái niệm chính trong tài liệu.

QUY TẮC BẮT BUỘC NHẤT NHẤT:
1. NGÔN NGỮ: BẮT BUỘC tất cả các nhãn (label) phải được viết bằng tiếng Việt tự nhiên, chính xác. Chỉ các thuật ngữ kỹ thuật chuyên ngành hoặc tên riêng nước ngoài mới được giữ nguyên tiếng Anh (ví dụ: React, API, DNA).
2. GIỚI HẠN ĐỘ SÂU: Chỉ tối đa 3 cấp (root → nhánh → lá). Không tạo nhánh sâu hơn.
3. Mỗi nút (label) tối đa 6 từ.
4. Root có 4-6 nhánh con trực tiếp.
5. Mỗi nhánh có 2-4 lá.
6. CHỈ TRẢ VỀ MỘT JSON OBJECT THUẦN TÚY, KHÔNG GÌ KHÁC: Không có markdown, không có backtick, không có giải thích, không có lời dẫn, không có kết luận, CHỈ JSON.
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
  const userPrompt = `${documentBlock}Hãy tạo cấu trúc sơ đồ tư duy phân cấp HOÀN TOÀN bằng tiếng Việt từ tài liệu trên. CHỈ TRẢ VỀ JSON OBJECT, KHÔNG GÌ KHÁC. Tuyệt đối không chứa các thẻ giữ chỗ như "{question_id}".`;
  return { systemPrompt, userPrompt };
}

async function ensureDocumentChunks({ doc, userId, text }) {
  try {
    let chunks = await DocumentChunkModel.findByDocumentId(doc.id);
    if (chunks.length) return chunks;

    const fullText = String(text || doc.extracted_text || '').trim();
    if (fullText) {
      const localChunks = ragService.splitTextIntoChunks(fullText, {
        documentId: doc.id,
        documentTitle: doc.title,
        pageBoundaries: doc.extraction_metadata?.pageBoundaries || [],
      });
      if (localChunks.length) {
        console.log(
          `Using ${localChunks.length} in-memory document chunks from full text (doc ${doc.id})`
        );
        return localChunks.map((chunk, index) => ({
          id: null,
          doc_id: doc.id,
          chunk_index: index,
          content: chunk.content,
          metadata: chunk.metadata || {},
        }));
      }
    }

    console.log(`Creating document chunks for material generation (doc ${doc.id})...`);
    await aiService.processDocument({ id: doc.id, userId, force: false });
    chunks = await DocumentChunkModel.findByDocumentId(doc.id);
    return chunks;
  } catch (err) {
    console.warn('Document chunks unavailable for material generation, falling back to raw text:', err.message);
    return [];
  }
}

function sortDocumentChunks(chunks) {
  return [...(chunks || [])].sort(
    (a, b) => Number(a.chunk_index ?? 0) - Number(b.chunk_index ?? 0)
  );
}

function formatChunkBlock(chunk) {
  const idx = Number(chunk.chunk_index ?? 0) + 1;
  const heading = chunk.metadata?.sectionHeading;
  const page = chunk.metadata?.pageNumber;
  const labels = [`Chunk ${idx}`];
  if (heading) labels.push(heading);
  if (page) labels.push(`trang ${page}`);
  return `[${labels.join(' | ')}]\n${String(chunk.content || '').trim()}`;
}

function buildBatchContextFromChunks(chunks, { attempt, maxAttempts, docTitle }) {
  const sorted = sortDocumentChunks(chunks);
  if (!sorted.length) return null;

  const numChunks = sorted.length;
  // const startIdx = numChunks <= 1
  //   ? 0
  //   : Math.floor((attempt * numChunks) / Math.max(1, maxAttempts)) % numChunks;
  const startIdx = attempt % numChunks;

  const parts = [];
  let usedChars = 0;
  let idx = startIdx;
  let visited = 0;

  while (visited < numChunks && usedChars < MATERIAL_CHUNK_WINDOW_CHARS) {
    const block = formatChunkBlock(sorted[idx]);
    if (usedChars > 0 && usedChars + block.length + 2 > MATERIAL_CHUNK_WINDOW_CHARS) break;
    parts.push(block);
    usedChars += block.length + 2;
    idx = (idx + 1) % numChunks;
    visited += 1;
  }

  const endIdx = visited > 0 ? ((startIdx + visited - 1) % numChunks) + 1 : startIdx + 1;
  const header = `[Tài liệu: ${docTitle || 'Untitled'} — chunk ${startIdx + 1}–${endIdx} / ${numChunks} (cùng hệ thống chunk như chatbot)]\n\n`;
  return header + parts.join('\n\n');
}

function buildGeminiContextFromChunks(chunks, { docTitle, maxChars = GEMINI_MATERIAL_MAX_CHARS }) {
  const sorted = sortDocumentChunks(chunks);
  if (!sorted.length) return null;

  const numChunks = sorted.length;
  const targetBlocks = Math.min(numChunks, Math.max(4, Math.floor(maxChars / 1400)));
  const indices = [];
  for (let i = 0; i < targetBlocks; i += 1) {
    indices.push(Math.min(numChunks - 1, Math.floor((i * numChunks) / targetBlocks)));
  }
  const uniqueIndices = [...new Set(indices)];

  const parts = [];
  let usedChars = 0;
  for (const chunkIdx of uniqueIndices) {
    const block = formatChunkBlock(sorted[chunkIdx]);
    if (usedChars + block.length + 2 > maxChars && usedChars > 0) break;
    parts.push(block);
    usedChars += block.length + 2;
  }

  return `[Tài liệu: ${docTitle || 'Untitled'} — ${parts.length}/${numChunks} đoạn trích đều từ toàn bộ tài liệu (chunk RAG)]\n\n${parts.join('\n\n')}`;
}

function buildBatchDocumentContext({ documentChunks, docTitle, fallbackText, attempt, maxAttempts }) {
  if (documentChunks?.length) {
    return buildBatchContextFromChunks(documentChunks, { attempt, maxAttempts, docTitle });
  }
  return getBatchDocumentSlice(fallbackText, attempt, maxAttempts);
}

function buildGeminiDocumentContext({ documentChunks, docTitle, fallbackText }) {
  if (documentChunks?.length) {
    return buildGeminiContextFromChunks(documentChunks, { docTitle, maxChars: GEMINI_MATERIAL_MAX_CHARS });
  }
  const text = String(fallbackText || '').trim();
  return text.length > GEMINI_MATERIAL_MAX_CHARS ? `${text.slice(0, GEMINI_MATERIAL_MAX_CHARS)}...` : text;
}

function getBatchDocumentSlice(fullText, attempt, maxAttempts = 20) {
  const text = String(fullText || '').trim();
  const windowSize = MATERIAL_CHUNK_WINDOW_CHARS;
  if (text.length <= windowSize) return text;

  const numSlices = Math.max(maxAttempts, Math.ceil(text.length / windowSize));
  const sliceIndex = attempt % numSlices;
  const maxStart = Math.max(0, text.length - windowSize);
  const start = numSlices <= 1
    ? 0
    : Math.min(Math.floor((sliceIndex * maxStart) / (numSlices - 1)), maxStart);
  const slice = text.slice(start, start + windowSize);

  return `[Phần ${sliceIndex + 1}/${numSlices} của tài liệu — ký tự ${start}–${start + slice.length} / ${text.length}]\n${slice}`;
}

function extractChunkHint(batchText) {
  const headingMatch = String(batchText || '').match(/\[Chunk \d+ \| ([^\]|]+)/);
  if (headingMatch) return headingMatch[1].trim();
  const partMatch = String(batchText || '').match(/chunk (\d+)–(\d+)/i);
  if (partMatch) return `phần chunk ${partMatch[1]}–${partMatch[2]}`;
  return null;
}

function appendExistingItemsPrompt(userPrompt, materialType, existingItems, { stalled = false, chunkHint = null } = {}) {
  if (!existingItems.length && !stalled && !chunkHint) return userPrompt;

  let suffix = '';
  if (existingItems.length) {
    const existingLines = materialType === 'flashcard'
      ? existingItems.map((item, index) => `${index + 1}. ${item.front}`).join('\n')
      : existingItems.map((item, index) => `${index + 1}. ${item.question}`).join('\n');

    suffix += `\n\nĐÃ CÓ ${existingItems.length} MỤC SAU — TUYỆT ĐỐI KHÔNG trùng lặp, paraphrase, hay hỏi lại cùng khái niệm:\n${existingLines}`;
    suffix += `\n\nCâu hỏi mới PHẢI về chủ đề/chi tiết KHÁC HOÀN TOÀN. Không được viết lại cùng ý bằng từ khác.`;
  }

  if (chunkHint) {
    suffix += `\n\nGợi ý chủ đề từ phần tài liệu hiện tại: "${chunkHint}" — hãy tạo câu hỏi về chi tiết cụ thể trong phần này mà CHƯA có trong danh sách trên.`;
  }

  if (stalled) {
    suffix += `\n\nCẢNH BÁO: Phản hồi trước bị TRÙNG LẶP hoặc THIẾU TRƯỜNG. Lần này BẮT BUỘC chọn khái niệm MỚI từ phần tài liệu hiện tại. Không hỏi lại mục lục, giới thiệu chung, hay câu hỏi đã có.`;
  }

  if (materialType === 'flashcard' && (stalled || existingItems.length > 0)) {
    suffix += `\n\nNHẮC LẠI: JSON bắt buộc có cả "front" và "back". Ví dụ: {"front":"Ai là tác giả?","back":"Karl Marx."}`;
  }

  return `${userPrompt}${suffix}`;
}

function parseMaterialArrayResponse(responseText, materialType) {
  const parsed = parseJsonLenient(responseText);
  if (parsed === null) {
    if (materialType === 'flashcard') {
      const loose = extractFlashcardsFromLooseText(responseText);
      if (loose.length) return loose;
    }
    console.warn(`Failed to parse ${materialType} JSON batch`);
    return [];
  }

  const content = normalizeArrayContent(parsed, materialType);
  if (materialType === 'flashcard') {
    let items = normalizeFlashcardItems(Array.isArray(content) ? content : []);
    if (!items.length) {
      items = extractFlashcardsFromLooseText(responseText);
    }
    return items;
  }
  if (materialType === 'quiz') {
    return normalizeQuizItems(Array.isArray(content) ? content : []);
  }
  return content;
}

async function generateOllamaBatches({
  materialType,
  fallbackText,
  documentChunks,
  docTitle,
  targetCount,
  callMaterialAi,
}) {
  const batchSize = OLLAMA_BATCH_SIZE[materialType] || 1;
  const minAttempts = OLLAMA_MAX_BATCH_ATTEMPTS[materialType] || 4;
  const maxAttempts = Math.max(minAttempts, targetCount * 4);
  let mergedItems = [];
  const usageMetadata = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let consecutiveEmpty = 0;
  let consecutiveDuplicate = 0;

  for (let attempt = 0; attempt < maxAttempts && mergedItems.length < targetCount; attempt += 1) {
    const sliceAttempt = attempt + (consecutiveDuplicate > 0 ? mergedItems.length + consecutiveDuplicate : 0);
    const batchText = buildBatchDocumentContext({
      documentChunks,
      docTitle,
      fallbackText,
      attempt: sliceAttempt,
      maxAttempts,
    });
    const count = Math.min(batchSize, targetCount - mergedItems.length);
    const batchPrompts = buildMaterialPrompts({ materialType, documentContext: batchText, count });
    const batchUserPrompt = appendExistingItemsPrompt(
      batchPrompts.userPrompt,
      materialType,
      mergedItems,
      {
        stalled: consecutiveDuplicate > 0 || consecutiveEmpty > 0,
        chunkHint: extractChunkHint(batchText),
      }
    );

    try {
      const result = await callMaterialAi({
        batchSystemPrompt: batchPrompts.systemPrompt,
        batchUserPrompt,
        temperature: (consecutiveDuplicate > 0 || consecutiveEmpty > 0) ? 0.7 : 0.2,
      });

      usageMetadata.promptTokens += result.usageMetadata?.promptTokens || 0;
      usageMetadata.completionTokens += result.usageMetadata?.completionTokens || 0;
      usageMetadata.totalTokens += result.usageMetadata?.totalTokens || 0;

      let batchItems = parseMaterialArrayResponse(result.text, materialType);

      if (materialType === 'flashcard' && batchItems.length) {
        const freshItems = batchItems.filter(
          (item) => !isKnownMaterialFront(item.front, mergedItems)
        );
        if (!freshItems.length) {
          consecutiveDuplicate += 1;
          console.warn(
            `Ollama flashcard batch ${attempt + 1}: duplicate skipped`,
            `(${String(batchItems[0]?.front || '').slice(0, 80)})`
          );
          continue;
        }
        batchItems = freshItems;
      }

      if (batchItems.length === 0 && materialType === 'flashcard') {
        const partialFront = extractPartialFlashcardFront(result.text);
        if (partialFront) {
          if (isKnownMaterialFront(partialFront, mergedItems)) {
            consecutiveDuplicate += 1;
            console.warn(
              `Ollama flashcard batch ${attempt + 1}: skipped duplicate front-only`,
              `(${partialFront.slice(0, 80)})`
            );
            continue;
          }
          const repaired = await repairFlashcardBack({
            front: partialFront,
            batchText,
            callMaterialAi,
          });
          if (repaired) {
            if (isKnownMaterialFront(repaired.front, mergedItems)) {
              consecutiveDuplicate += 1;
              console.warn(
                `Ollama flashcard batch ${attempt + 1}: repaired card was duplicate`,
                `(${repaired.front.slice(0, 80)})`
              );
              continue;
            }
            batchItems = normalizeFlashcardItems([repaired]);
            console.log(
              `Ollama flashcard batch ${attempt + 1}: repaired front-only via back call`
            );
          }
        }
      }

      if (materialType === 'quiz' && batchItems.length) {
        const freshItems = batchItems.filter(
          (item) => !isKnownQuizQuestion(item.question, mergedItems)
        );
        if (!freshItems.length) {
          consecutiveDuplicate += 1;
          console.warn(
            `Ollama quiz batch ${attempt + 1}: duplicate skipped`,
            `(${String(batchItems[0]?.question || '').slice(0, 80)})`
          );
          continue;
        }
        batchItems = freshItems;
      }

      if (batchItems.length === 0) {
        consecutiveEmpty += 1;
        console.warn(
          `Ollama ${materialType} batch ${attempt + 1}/${maxAttempts} returned 0 valid items`,
          `(raw preview: ${String(result.text || '').slice(0, 200).replace(/\s+/g, ' ')})`
        );
        continue;
      }

      consecutiveEmpty = 0;
      const beforeCount = mergedItems.length;
      mergedItems = dedupeMaterialItems([...mergedItems, ...batchItems], materialType);
      mergedItems = enforceTargetCount(mergedItems, materialType);
      const newCount = mergedItems.length - beforeCount;
      if (newCount === 0) {
        consecutiveDuplicate += 1;
        const dupLabel = materialType === 'flashcard'
          ? batchItems[0]?.front
          : batchItems[0]?.question;
        console.warn(
          `Ollama ${materialType} batch ${attempt + 1}: duplicate skipped`,
          `(${String(dupLabel || '').slice(0, 80)})`
        );
      } else {
        consecutiveDuplicate = 0;
      }
      console.log(
        `Ollama ${materialType} batch ${attempt + 1}: +${newCount} new (${batchItems.length} parsed), total ${beforeCount} -> ${mergedItems.length}`
      );
    } catch (batchErr) {
      consecutiveEmpty += 1;
      console.warn(`Ollama ${materialType} batch ${attempt + 1}/${maxAttempts} failed:`, batchErr.message);
    }
  }

  if (mergedItems.length < targetCount) {
    console.warn(
      `Ollama ${materialType}: finished ${maxAttempts} batches with ${mergedItems.length}/${targetCount} items`
    );
  }

  return { items: mergedItems, usageMetadata };
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

    const resolvedModel = aiUsageService.resolveModel(model);
    const selectedModel = resolvedModel.model;
    const selectedProvider = resolvedModel.provider;

    const documentChunks = await ensureDocumentChunks({ doc, userId, text });
    if (documentChunks.length) {
      console.log(`Material generation using ${documentChunks.length} document chunks`);
    }

    const documentContext = buildGeminiDocumentContext({
      documentChunks,
      docTitle: doc.title,
      fallbackText: text,
    });

    const targetCount = MATERIAL_TARGETS[materialType];
    const { systemPrompt, userPrompt } = buildMaterialPrompts({
      materialType,
      documentContext,
      count: targetCount || 1,
    });

    // Estimate prompt tokens (characters / 4)
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    // Check usage limits if using Gemini
    if (selectedProvider === 'gemini') {
      await aiUsageService.assertQuota({ model: selectedModel, userId, estimatedTokens });
    }

    let responseText;
    let usageMetadata = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const callMaterialAi = async ({ batchSystemPrompt, batchUserPrompt, temperature = 0.2 }) => {
      if (selectedProvider === 'ollama') {
        const result = await ollamaService.generateChat({
          model: selectedModel,
          systemPrompt: batchSystemPrompt,
          userPrompt: batchUserPrompt,
          format: 'json',
          options: {
            num_predict: materialType === 'flashcard' ? 1024 : 2048,
            num_ctx: 8192,
            temperature,
          },
        });
        return {
          text: result.text,
          usageMetadata: result.usageMetadata || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }

      const result = await geminiService.queryDocumentChunks({
        model: selectedModel,
        systemPrompt: batchSystemPrompt,
        userPrompt: batchUserPrompt,
      });
      return {
        text: result.text,
        usageMetadata: result.usageMetadata || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    };

    try {
      if (selectedProvider === 'ollama' && (materialType === 'flashcard' || materialType === 'quiz')) {
        const batchResult = await generateOllamaBatches({
          materialType,
          fallbackText: text,
          documentChunks,
          docTitle: doc.title,
          targetCount,
          callMaterialAi,
        });

        usageMetadata = batchResult.usageMetadata;
        responseText = JSON.stringify(batchResult.items);
      } else {
        const result = await callMaterialAi({
          batchSystemPrompt: systemPrompt,
          batchUserPrompt: userPrompt,
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

      if (errMsg.includes('timed out') || err.statusCode === 504) {
        const customErr = createError(504, err.message || 'Local AI model request timed out');
        customErr.publicMessage = err.publicMessage || 'Ollama phản hồi quá chậm. Hãy thử lại hoặc chọn mô hình Gemini.';
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
    let content;
    if (materialType === 'flashcard' || materialType === 'quiz') {
      if (selectedProvider === 'ollama') {
        content = cleanAndParseJsonStrict(responseText);
        if (!Array.isArray(content)) content = [];
        content = enforceTargetCount(content, materialType);
      } else {
        content = parseMaterialArrayResponse(responseText, materialType);
        content = enforceTargetCount(content, materialType);
      }

      if (content.length === 0) {
        console.error(`No valid ${materialType} items after normalization. Provider=${selectedProvider}, model=${selectedModel}`);
        const err = createError(500, materialType === 'flashcard'
          ? 'AI did not return a valid list of flashcards'
          : 'AI did not return a valid quiz list');
        err.publicMessage = materialType === 'flashcard'
          ? 'Không tạo được thẻ ghi nhớ hợp lệ. Hãy thử lại hoặc chọn mô hình Gemini.'
          : 'Không tạo được câu hỏi trắc nghiệm hợp lệ. Hãy thử lại hoặc chọn mô hình Gemini.';
        throw err;
      }

      assertMaterialTargetCount(content, materialType, {
        provider: selectedProvider,
        model: selectedModel,
      });
    } else {
      content = cleanAndParseJsonStrict(responseText);
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

module.exports = StudyMaterialService;
