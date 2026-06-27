const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 6000;

const COMPARISON_PATTERN = /\b(compare|comparison|versus|vs\.?|differences?)\b|so s[aá]nh|[đd]ối chiếu|kh[aá]c nhau|[đd]iểm kh[aá]c/iu;
const BRIEF_PATTERN = /\b(brief|briefly|concise|shorter|short response)\b|ngắn gọn|ngắn hơn|rút gọn|súc tích/iu;
const ONLY_DIFFERENCES_PATTERN = /only\s+(?:show|state|list|mention)?\s*(?:the\s+)?differences?|chỉ\s+(?:nêu|liệt kê|cho biết)?\s*(?:các\s+)?(?:điểm\s+)?khác/iu;
const TABLE_PATTERN = /\btable\b|bảng/iu;
const PARAGRAPH_PATTERN = /\bparagraph\b|đoạn văn/iu;
const BULLET_PATTERN = /\b(bullets?|bullet points?)\b|gạch đầu dòng/iu;
const TOPIC_FOCUS_PATTERN = /(?:focus(?:\s+only)?\s+on|only\s+focus\s+on|chỉ\s+tập trung\s+(?:vào|về)|tập trung\s+(?:vào|về))\s+(.+)/iu;
const FORMAT_ONLY_PATTERN = /^(?:(?:please|hãy|vui lòng)\s+)?(?:make it|nói|trả lời|viết)?\s*(?:ngắn gọn hơn|ngắn hơn|súc tích hơn|shorter|more concise|briefly)(?:\s+(?:please|nhé))?[.!?]*$/iu;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function detectPointCount(question) {
  const match = normalizeText(question).match(/(?:trong|in)?\s*(\d{1,2})\s*(?:ý|điểm|points?|bullets?)/iu);
  if (!match) return null;
  const count = Number(match[1]);
  return count >= 1 && count <= 20 ? count : null;
}

const STUDIO_META_STRIP_PATTERN = /\n*\[(?:studio-quiz-meta|studio-flashcard-meta)\][\s\S]*$/i;

function stripStudioMetaFromDisplay(text) {
  return String(text || '').replace(STUDIO_META_STRIP_PATTERN, '').trim();
}

const QUIZ_HELP_PATTERN = /(?:đang làm bài trắc nghiệm|\[studio-quiz-meta\]|bài kiểm tra đã tạo|đáp án đúng theo bài)/iu;
const STUDIO_QUIZ_META_PATTERN = /\[studio-quiz-meta\]\s*([\s\S]*)/iu;

function detectQuizHelpConstraints(question) {
  const text = String(question || '');
  if (!QUIZ_HELP_PATTERN.test(text)) return null;

  let storedAnswer = '';
  const metaMatch = text.match(STUDIO_QUIZ_META_PATTERN);
  if (metaMatch) {
    const answerMatch = metaMatch[1].match(/Đáp án đúng:\s*([^\n]+)/iu);
    storedAnswer = answerMatch ? answerMatch[1].trim() : '';
  } else {
    const answerMatch = text.match(/Đáp án đúng theo bài kiểm tra đã tạo:\s*([^\n]+)/iu);
    storedAnswer = answerMatch ? answerMatch[1].trim() : '';
  }

  return {
    quizHelp: true,
    vietnameseOnly: true,
    noMarkdown: true,
    brief: true,
    structure: 'paragraph',
    storedQuizAnswer: storedAnswer,
  };
}

function detectFlashcardHelpConstraints(question) {
  const text = String(question || '');
  if (!/\[studio-flashcard-meta\]/i.test(text)) return null;

  const metaMatch = text.match(/\[studio-flashcard-meta\]\s*([\s\S]*)/i);
  const storedAnswer = metaMatch
    ? metaMatch[1].replace(/^Gợi ý đáp án:\s*/iu, '').trim()
    : '';

  return {
    flashcardHelp: true,
    vietnameseOnly: true,
    noMarkdown: true,
    brief: true,
    structure: 'paragraph',
    storedFlashcardAnswer: storedAnswer,
  };
}

function detectResponseConstraints(question) {
  const text = normalizeText(question);
  const pointCount = detectPointCount(text);
  let structure = null;
  if (TABLE_PATTERN.test(text)) structure = 'table';
  else if (PARAGRAPH_PATTERN.test(text)) structure = 'paragraph';
  else if (BULLET_PATTERN.test(text) || pointCount) structure = 'bullets';

  const studioHelp = detectQuizHelpConstraints(question) || detectFlashcardHelpConstraints(question) || {};

  return {
    brief: BRIEF_PATTERN.test(text) || Boolean(studioHelp.brief),
    onlyDifferences: ONLY_DIFFERENCES_PATTERN.test(text),
    pointCount: studioHelp.brief ? null : pointCount,
    structure: studioHelp.structure || structure,
    ...studioHelp,
  };
}

function mergeConstraints(previous = {}, current = {}, { inherit = false } = {}) {
  if (!inherit) return current;
  return {
    brief: Boolean(previous.brief || current.brief),
    onlyDifferences: current.onlyDifferences || Boolean(previous.onlyDifferences),
    pointCount: current.pointCount ?? previous.pointCount ?? null,
    structure: current.structure || previous.structure || null,
  };
}

function getRecentConversation(messages) {
  const eligible = (messages || [])
    .filter((message) => message?.role === 'user' || message?.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES);
  const selected = [];
  let usedChars = 0;

  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const message = eligible[index];
    const remaining = MAX_HISTORY_CHARS - usedChars;
    if (remaining <= 0) break;
    const content = normalizeText(message.content).slice(0, remaining);
    if (!content) continue;
    selected.unshift({
      id: message.id,
      role: message.role,
      content,
      metadata: message.metadata || {},
    });
    usedChars += content.length;
  }

  return selected;
}

function findInheritedContext(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const metadata = history[index].metadata || {};
    if (metadata.substantiveQuestion || metadata.intent === 'comparison') {
      return metadata;
    }
  }
  return {};
}

function normalizeComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveMentionedDocumentIds(question, documents) {
  const normalizedQuestion = normalizeComparable(question);
  return (documents || [])
    .filter((document) => {
      const title = normalizeComparable(document.title);
      return title.length >= 3 && normalizedQuestion.includes(title);
    })
    .map((document) => Number(document.id));
}

function analyzeRequest({ question, history, documents }) {
  const cleanedQuestion = normalizeText(question);
  const recentHistory = getRecentConversation(history);
  const inherited = findInheritedContext(recentHistory);
  const formattingOnly = FORMAT_ONLY_PATTERN.test(cleanedQuestion);
  const topicMatch = cleanedQuestion.match(TOPIC_FOCUS_PATTERN);
  const topicFocus = topicMatch ? normalizeText(topicMatch[1]) : null;
  const explicitComparison = COMPARISON_PATTERN.test(cleanedQuestion);
  const inheritsComparison = (formattingOnly || topicFocus) && inherited.intent === 'comparison';
  const intent = explicitComparison || inheritsComparison ? 'comparison' : 'question';
  const currentConstraints = detectResponseConstraints(cleanedQuestion);
  const responseConstraints = mergeConstraints(
    inherited.responseConstraints,
    currentConstraints,
    { inherit: formattingOnly || Boolean(topicFocus) }
  );
  if (formattingOnly && currentConstraints.brief) {
    responseConstraints.pointCount = 1;
    responseConstraints.structure = 'paragraph';
  }
  const mentionedIds = resolveMentionedDocumentIds(cleanedQuestion, documents);
  const inheritedIds = (inherited.comparedDocumentIds || []).map(Number);
  const availableIds = new Set((documents || []).map((document) => Number(document.id)));
  let comparedDocumentIds = [];

  if (intent === 'comparison') {
    if (mentionedIds.length >= 2) comparedDocumentIds = mentionedIds;
    else if (inheritsComparison && inheritedIds.length >= 2) comparedDocumentIds = inheritedIds;
    else comparedDocumentIds = [...availableIds];
    comparedDocumentIds = comparedDocumentIds.filter((id) => availableIds.has(id));
  }

  const filteredHistory = recentHistory.filter((message) => {
    const messageDocumentIds = (message.metadata?.comparedDocumentIds || []).map(Number);
    return !messageDocumentIds.length || messageDocumentIds.every((id) => availableIds.has(id));
  });
  const promptHistory = intent === 'comparison'
    ? filteredHistory.filter((message) => message.role === 'user')
    : filteredHistory;
  const comparisonUnavailable = intent === 'comparison' && comparedDocumentIds.length < 2;

  const previousQuestion = normalizeText(inherited.substantiveQuestion);
  let substantiveQuestion = cleanedQuestion;
  let retrievalQuery = cleanedQuestion;
  if (formattingOnly && previousQuestion) {
    substantiveQuestion = previousQuestion;
    retrievalQuery = normalizeText(inherited.retrievalQuery) || previousQuestion;
  } else if (topicFocus && previousQuestion) {
    retrievalQuery = topicFocus;
    substantiveQuestion = `${previousQuestion}\nCurrent focus: ${topicFocus}`;
  }

  return {
    intent,
    comparedDocumentIds,
    inheritedComparedDocumentIds: inheritedIds,
    activeAttachmentIds: [...availableIds],
    filteredComparedDocumentIds: comparedDocumentIds,
    comparisonUnavailable,
    substantiveQuestion,
    retrievalQuery,
    responseConstraints,
    formattingOnly,
    topicFocus,
    history: promptHistory,
  };
}

function buildComparisonUnavailableAnswer(question) {
  const vietnamese = /[ăâđêôơưáàảãạấầẩẫậéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]|\b(tài liệu|so sánh|chỉ còn)\b/iu
    .test(String(question || ''));
  return vietnamese
    ? 'Hiện chỉ còn một tài liệu được đính kèm nên không thể so sánh hai tài liệu.'
    : 'Only one document is currently attached, so two documents cannot be compared.';
}

function buildConstraintInstructions(constraints = {}) {
  const instructions = [];
  if (constraints.vietnameseOnly) {
    instructions.push(
      'BẮT BUỘC trả lời hoàn toàn bằng tiếng Việt tự nhiên. TUYỆT ĐỐI KHÔNG dùng tiếng Trung, tiếng Anh (trừ tên riêng/thuật ngữ chuyên ngành), hay ngôn ngữ khác.'
    );
  }
  if (constraints.noMarkdown) {
    instructions.push('Không dùng markdown, không dùng **, không dùng danh sách gạch đầu dòng. Viết 2-3 câu văn xuôi đơn giản.');
  }
  if (constraints.quizHelp) {
    const answerHint = constraints.storedQuizAnswer
      ? `Đáp án đúng đã được cung cấp trong câu hỏi: "${constraints.storedQuizAnswer}". Bạn PHẢI xác nhận đúng đáp án này, không được mâu thuẫn hay đổi sang phương án khác.`
      : 'Người dùng đang hỏi về câu trắc nghiệm Studio. Bám sát đáp án đúng đã nêu trong câu hỏi, không mâu thuẫn với nó.';
    instructions.push(
      'Đây là yêu cầu giải thích câu hỏi trắc nghiệm từ Studio.',
      answerHint,
      'Giải thích ngắn gọn vì sao đáp án đó đúng dựa trên các đoạn tài liệu được trích, không bịa thêm.'
    );
  }
  if (constraints.flashcardHelp) {
    const answerHint = constraints.storedFlashcardAnswer
      ? `Câu trả lời tham khảo: "${constraints.storedFlashcardAnswer}". Bám sát nội dung này và giải thích sâu hơn dựa trên tài liệu.`
      : 'Giải thích sâu hơn nội dung thẻ ghi nhớ dựa trên tài liệu.';
    instructions.push(
      'Đây là yêu cầu giải thích thẻ ghi nhớ từ Studio.',
      answerHint,
      'Viết 2-3 câu văn xuôi tiếng Việt, không markdown, không gạch đầu dòng.'
    );
  }
  if (constraints.brief) {
    instructions.push('Keep the answer brief while retaining the essential result. Omit generic advice and unrelated explanation.');
  }
  if (constraints.onlyDifferences) {
    instructions.push('State only evidence-supported differences. Do not restate similarities or background information.');
  }
  if (constraints.pointCount) {
    instructions.push(`Use no more than ${constraints.pointCount} points.`);
  }
  if (constraints.structure === 'table') instructions.push('Use a compact table.');
  if (constraints.structure === 'bullets') instructions.push('Use concise bullet points.');
  if (constraints.structure === 'paragraph') instructions.push('Use a single concise paragraph.');
  return instructions;
}

module.exports = {
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_CHARS,
  analyzeRequest,
  buildComparisonUnavailableAnswer,
  buildConstraintInstructions,
  detectResponseConstraints,
  getRecentConversation,
  normalizeComparable,
  stripStudioMetaFromDisplay,
};
