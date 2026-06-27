const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 6000;
const MAX_EXPLICIT_COMPARISON_DOCUMENTS = 4;

const COMPARISON_PATTERN = /\b(compare|comparison|versus|vs\.?|differences?|related|relationship|relation)\b|so s[aá]nh|[đd]ối chiếu|kh[aá]c nhau|[đd]iểm kh[aá]c|li[eê]n\s+quan/iu;
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

const DOCUMENT_REFERENCE_STOP_WORDS = new Set([
  'file', 'files', 'document', 'documents', 'attachment', 'attachments',
  'report', 'assignment', 'pdf', 'doc', 'docx', 'txt', 'image',
  'tai', 'lieu', 'tep', 'tap', 'dinh', 'kem', 'bai', 'bao', 'cao',
  'trong', 'cua', 've', 'noi', 'dung', 'nay', 'this', 'that', 'main',
  'primary', 'current',
]);

const PRIMARY_DOCUMENT_ALIAS_PATTERN = /\b(primary document|main document|primary file|main file)\b|tai lieu chinh|file chinh/iu;
const CONTEXTUAL_DOCUMENT_PATTERN = /\b(this file|this attachment|current file|current attachment)\b|file nay|tep nay|tai lieu nay|tep dinh kem nay/iu;

function getStorageFileName(document) {
  const storagePath = String(document?.cloud_files?.storage_path || '');
  const parts = storagePath.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function stripExtension(value) {
  return String(value || '').replace(/\.[a-z0-9]{1,8}$/iu, '');
}

// Strip a trailing duplicate-copy suffix such as " (1)" or " (2)" so that a
// document named "TRƯỜNG ĐẠI HỌC KINH TẾ (1).docx" also matches a query that
// references it as "TRƯỜNG ĐẠI HỌC KINH TẾ" (without the numeric suffix).
function stripDuplicateSuffix(value) {
  return String(value || '').replace(/\s*\(\d+\)\s*$/, '');
}

function documentDisplayNames(document) {
  return [
    document?.title,
    document?.filename,
    document?.file_name,
    document?.original_filename,
    document?.cloud_files?.file_name,
    document?.cloud_files?.filename,
    getStorageFileName(document),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function documentNameProfile(document) {
  const names = [...new Set(documentDisplayNames(document))];
  const exactNames = names.map((name) => name.toLowerCase());
  const normalizedNames = names.map(normalizeComparable).filter(Boolean);
  // Include both the raw basename and a de-duplicated variant (stripping a
  // trailing " (N)" copy suffix) so that e.g. "Report (1).docx" matches a
  // query that says "Report" without the numeric suffix.
  const rawBasenames = names.map(stripExtension).map(normalizeComparable);
  const deduplicatedBasenames = names
    .map(stripExtension)
    .map(stripDuplicateSuffix)
    .map(normalizeComparable);
  const basenames = [...new Set([...rawBasenames, ...deduplicatedBasenames])].filter(Boolean);
  const tokens = new Set();
  const tokenSequences = new Set();

  for (const normalized of [...normalizedNames, ...basenames]) {
    const parts = normalized.split(/\s+/).filter(Boolean);
    for (const token of parts) {
      if (token.length >= 3 && !DOCUMENT_REFERENCE_STOP_WORDS.has(token)) tokens.add(token);
    }
    for (let index = 0; index < parts.length - 1; index += 1) {
      const sequence = `${parts[index]} ${parts[index + 1]}`;
      if (!sequence.split(/\s+/).some((token) => DOCUMENT_REFERENCE_STOP_WORDS.has(token))) {
        tokenSequences.add(sequence);
      }
    }
  }

  return {
    id: Number(document.id),
    document,
    exactNames,
    normalizedNames: [...new Set(normalizedNames)],
    basenames: [...new Set(basenames)],
    tokens: [...tokens],
    tokenSequences: [...tokenSequences],
  };
}

function uniqueMatches(matches) {
  const byId = new Map();
  for (const match of matches || []) {
    const id = Number(match.id);
    if (Number.isInteger(id)) byId.set(id, match.document);
  }
  return [...byId.entries()].map(([id, document]) => ({ id, document }));
}

function matchesByPriority(question, documents) {
  const profiles = (documents || []).map(documentNameProfile);
  const normalizedQuestion = normalizeComparable(question);
  const lowerQuestion = String(question || '').toLowerCase();
  const priorityChecks = [
    ['exact', (profile) => profile.exactNames.some((name) => name && lowerQuestion.includes(name))],
    ['normalized_exact', (profile) => profile.normalizedNames.some((name) => name.length >= 3 && normalizedQuestion.includes(name))],
    ['basename', (profile) => profile.basenames.some((name) => name.length >= 3 && normalizedQuestion.includes(name))],
    ['prefix', (profile) => profile.normalizedNames.some((name) => (
      name.length >= 3 && normalizedQuestion.split(/\s+/).some((term) => (
        term.length >= 3 && !DOCUMENT_REFERENCE_STOP_WORDS.has(term) && name.startsWith(term)
      ))
    ))],
  ];

  for (const [kind, check] of priorityChecks) {
    const matches = uniqueMatches(profiles.filter(check));
    if (matches.length) return { matches, kind };
  }

  const tokenOwners = new Map();
  const sequenceOwners = new Map();
  for (const profile of profiles) {
    for (const token of profile.tokens) {
      const owners = tokenOwners.get(token) || new Set();
      owners.add(profile.id);
      tokenOwners.set(token, owners);
    }
    for (const sequence of profile.tokenSequences) {
      const owners = sequenceOwners.get(sequence) || new Set();
      owners.add(profile.id);
      sequenceOwners.set(sequence, owners);
    }
  }

  const tokenMatches = uniqueMatches(profiles.filter((profile) => {
    const hasUniqueSequence = profile.tokenSequences.some((sequence) => (
      sequence.length >= 7
      && normalizedQuestion.includes(sequence)
      && sequenceOwners.get(sequence)?.size === 1
    ));
    const hasUniqueToken = profile.tokens.some((token) => (
      token.length >= 3
      && normalizedQuestion.includes(token)
      && tokenOwners.get(token)?.size === 1
    ));
    return hasUniqueSequence || hasUniqueToken;
  }));
  return { matches: tokenMatches, kind: 'token' };
}

function buildAmbiguousScope(matches, reason = 'ambiguous_document_reference') {
  return {
    type: 'ambiguous',
    documentIds: [],
    matchingDocuments: uniqueMatches(matches).map(({ document }) => ({
      id: Number(document.id),
      title: document.title,
    })),
    reason,
  };
}

function resolveContextualDocumentScope({ question, documents, primaryDocumentId, focusedDocumentId }) {
  const normalizedQuestion = normalizeComparable(question);
  if (!CONTEXTUAL_DOCUMENT_PATTERN.test(normalizedQuestion)) return null;
  const availableIds = new Set((documents || []).map((document) => Number(document.id)));

  if (focusedDocumentId != null && availableIds.has(Number(focusedDocumentId))) {
    return {
      type: 'explicit_single',
      documentIds: [Number(focusedDocumentId)],
      matchingDocuments: [],
      reason: 'focused_document',
    };
  }

  const attachments = (documents || []).filter((document) => (
    Number(document.id) !== Number(primaryDocumentId)
  ));
  if (attachments.length === 1) {
    return {
      type: 'explicit_single',
      documentIds: [Number(attachments[0].id)],
      matchingDocuments: [],
      reason: 'single_attachment_context',
    };
  }
  if (attachments.length > 1) {
    return buildAmbiguousScope(attachments.map((document) => ({ id: document.id, document })), 'ambiguous_contextual_reference');
  }
  return null;
}

function resolveDocumentScope({
  question,
  documents,
  primaryDocumentId,
  focusedDocumentId = null,
  intent = 'question',
}) {
  const normalizedQuestion = normalizeComparable(question);
  const availableDocuments = documents || [];

  if (PRIMARY_DOCUMENT_ALIAS_PATTERN.test(normalizedQuestion)) {
    const primary = availableDocuments.find((document) => Number(document.id) === Number(primaryDocumentId));
    return primary
      ? {
        type: intent === 'comparison' ? 'comparison' : 'explicit_single',
        documentIds: [Number(primary.id)],
        matchingDocuments: [],
        reason: 'primary_alias',
      }
      : {
        type: 'general',
        documentIds: availableDocuments.map((document) => Number(document.id)),
        matchingDocuments: [],
        reason: 'primary_alias_unavailable',
      };
  }

  const contextual = resolveContextualDocumentScope({
    question,
    documents: availableDocuments,
    primaryDocumentId,
    focusedDocumentId,
  });
  if (contextual) return contextual;

  const { matches, kind: matchKind } = matchesByPriority(question, availableDocuments);
  if (matches.length > MAX_EXPLICIT_COMPARISON_DOCUMENTS) {
    return buildAmbiguousScope(matches, 'too_many_document_matches');
  }
  if (matches.length > 1) {
    if (matchKind === 'prefix') {
      return buildAmbiguousScope(matches, 'ambiguous_prefix_reference');
    }
    return {
      type: intent === 'comparison' ? 'comparison' : 'explicit_multi',
      documentIds: matches.map((match) => Number(match.id)),
      matchingDocuments: [],
      reason: 'named_documents',
    };
  }
  if (matches.length === 1) {
    return {
      type: intent === 'comparison' ? 'comparison' : 'explicit_single',
      documentIds: [Number(matches[0].id)],
      matchingDocuments: [],
      reason: 'named_document',
    };
  }
  if (intent === 'comparison') {
    return {
      type: 'comparison',
      documentIds: availableDocuments.map((document) => Number(document.id)),
      matchingDocuments: [],
      reason: 'comparison_all_documents',
    };
  }
  return {
    type: 'general',
    documentIds: availableDocuments.map((document) => Number(document.id)),
    matchingDocuments: [],
    reason: 'no_explicit_document_reference',
  };
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
