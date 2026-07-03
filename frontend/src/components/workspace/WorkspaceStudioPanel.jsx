import React, { useState, useEffect, useCallback } from "react";
import { getStudyMaterials, generateStudyMaterial, deleteStudyMaterial } from "../../services/aiApi.js";
import { SparklesIcon, ClockIcon } from "./WorkspaceIcons.jsx";
import WorkspaceRoadmapPanel from "./WorkspaceRoadmapPanel.jsx";

// Custom icons for the Studio panel
function FlashcardIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}

function QuizIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function MindmapIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="3" r="2" fill="currentColor" />
      <circle cx="12" cy="21" r="2" fill="currentColor" />
      <circle cx="3" cy="12" r="2" fill="currentColor" />
      <circle cx="21" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Roadmap grid icon component.
 * @param {object} props
 * @param {string} [props.className] - CSS classes.
 * @param {number} [props.size] - Width/height size (default 20).
 */
function RoadmapIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h7v7H3z" />
      <path d="M14 4h7v4h-7z" />
      <path d="M14 12h7v8h-7z" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
      <path d="M10 10h4" />
    </svg>
  );
}

/**
 * Lock padlock icon component.
 * @param {object} props
 * @param {string} [props.className] - CSS classes.
 * @param {number} [props.size] - Width/height size (default 16).
 */
function LockIcon({ className, size = 16 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Tree view for Mindmap
function MindmapNode({ node, depth = 0, forceOpen }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
    }
  }, [forceOpen]);

  return (
    <div className="ml-4 mt-2">
      <div className="flex items-center gap-2">
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus:outline-none"
          >
            {isOpen ? "−" : "+"}
          </button>
        )}
        <span
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-all duration-200 ${depth === 0
            ? "border-indigo-200 bg-indigo-50 text-indigo-800 shadow-indigo-50/50 scale-105"
            : depth === 1
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-50/50 scale-100"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
        >
          {node.label}
        </span>
      </div>
      {hasChildren && isOpen && (
        <div className="relative border-l border-slate-200 pl-4 mt-1 ml-2.5 transition-all duration-300">
          {node.children.map((child, idx) => (
            <MindmapNode key={idx} node={child} depth={depth + 1} forceOpen={forceOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

const STUDIO_MATERIAL_COUNTS = { flashcard: 10, quiz: 5 };

function normalizeOptionText(value) {
  return String(value || "").trim().toLowerCase();
}

function findOptionLetter(options, answer) {
  const idx = (options || []).findIndex((opt) => normalizeOptionText(opt) === normalizeOptionText(answer));
  return idx !== -1 ? String.fromCharCode(65 + idx) : "";
}

function formatQuizOptions(options) {
  return (options || [])
    .map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`)
    .join("\n");
}

function buildQuizChatPayload(question, { userAnswer } = {}) {
  const options = question.options || [];
  const optionsText = formatQuizOptions(options);
  const correctLetter = findOptionLetter(options, question.answer);

  let displayText = `Tôi đang làm bài trắc nghiệm từ tài liệu nguồn trong Studio.

Câu hỏi: "${question.question}"

Các lựa chọn:
${optionsText}`;

  if (userAnswer !== undefined) {
    const userLetter = findOptionLetter(options, userAnswer);
    displayText += `\n\nLựa chọn của tôi: ${userLetter ? `${userLetter}. ` : ""}${userAnswer}`;
  }

  // displayText += "\n\nHãy giải thích chủ đề này chi tiết hơn.";
  displayText += `\n\nHãy phân tích chi tiết câu hỏi trắc nghiệm này:
1. Giải thích lý do tại sao đáp án chính xác lại đúng dựa trên tài liệu nguồn.
2. Phân tích ngắn gọn tính đúng/sai của các phương án còn lại (đặc biệt nhấn mạnh lý do phương án tôi chọn chưa chính xác nếu tôi trả lời sai).
3. Hướng dẫn mẹo tư duy nhanh hoặc từ khóa mấu chốt để áp dụng phương pháp loại trừ cho câu hỏi này.`;
  
  const questionForApi = `${displayText}

[studio-quiz-meta]
Đáp án đúng: ${correctLetter ? `${correctLetter}. ` : ""}${question.answer}
Giải thích tham khảo: ${question.explanation || "Chưa có"}`;

  return { displayText, question: questionForApi };
}

function buildFlashcardChatPayload(front, back) {
  const displayText = `Tôi đang xem lại thẻ ghi nhớ trong Studio.

Câu hỏi: "${front}"

Câu trả lời: "${back}"

Hãy giải thích chủ đề này chi tiết hơn.`;
  const questionForApi = `${displayText}

[studio-flashcard-meta]
Gợi ý đáp án: ${back}`;
  return { displayText, question: questionForApi };
}

export default function WorkspaceStudioPanel({ selectedDocument, selectedModel, width, onAskQuestion, onGoToPage, className = "" }) {
  const [materials, setMaterials] = useState([]);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStateText, setLoadingStateText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardOrder, setCardOrder] = useState([]);
  const [knownCards, setKnownCards] = useState(new Set());
  const [unknownCards, setUnknownCards] = useState(new Set());
  const [isDeckFinished, setIsDeckFinished] = useState(false);
  const [isPracticeDropdownOpen, setIsPracticeDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Quiz state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionIdx]: selectedOptionString }
  const [quizScore, setQuizScore] = useState(null);

  // Mindmap state
  const [mindmapAllOpen, setMindmapAllOpen] = useState(undefined);

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStudyMaterials(selectedDocument.id);
      setMaterials(data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Không thể tải danh sách tài liệu học tập.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDocument]);

  useEffect(() => {
    if (selectedDocument) {
      loadMaterials();
      setActiveMaterial(null);
      setIsRoadmapOpen(false);
    } else {
      setMaterials([]);
      setActiveMaterial(null);
      setIsRoadmapOpen(false);
    }
  }, [selectedDocument, loadMaterials]);

  async function handleGenerate(type) {
    if (!selectedDocument) return;
    setIsGenerating(true);
    setError(null);
    setLoadingStateText(
      type === "flashcard"
        ? "Đang phân tích tài liệu và tạo thẻ ghi nhớ..."
        : type === "quiz"
          ? "Đang biên soạn câu hỏi trắc nghiệm tự ôn luyện..."
          : "Đang dựng cấu trúc bản đồ tư duy..."
    );

    try {
      const saved = await generateStudyMaterial(selectedDocument.id, type, selectedModel);
      setMaterials([saved, ...materials]);
      setActiveMaterial(saved);
      // Reset views
      setCurrentCardIndex(0);
      setIsFlipped(false);
      if (type === "flashcard" && saved.content) {
        setCardOrder([...Array(saved.content.length).keys()]);
        setKnownCards(new Set());
        setUnknownCards(new Set());
        setIsDeckFinished(false);
      }
      setCurrentQuizIndex(0);
      setSelectedAnswers({});
      setQuizScore(null);
      setMindmapAllOpen(undefined);
    } catch (err) {
      setError(err.response?.data?.error || "Tạo tài liệu học tập thất bại. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDeleteClick(id, e) {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  function handleOpenMaterial(material) {
    setActiveMaterial(material);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    if (material && material.material_type === "flashcard" && material.content) {
      setCardOrder([...Array(material.content.length).keys()]);
      setKnownCards(new Set());
      setUnknownCards(new Set());
      setIsDeckFinished(false);
    }
    setCurrentQuizIndex(0);
    setSelectedAnswers({});
    setQuizScore(null);
    setMindmapAllOpen(undefined);
  }

  // Keyboard shortcuts for Flashcard study mode
  useEffect(() => {
    if (!activeMaterial || activeMaterial.material_type !== 'flashcard' || isDeckFinished) return;

    const cardLength = cardOrder.length || 0;
    const activeCardIndex = cardOrder[currentCardIndex] !== undefined
      ? cardOrder[currentCardIndex]
      : currentCardIndex;

    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(f => !f);
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const wasFlipped = isFlipped;
        setIsFlipped(false);
        setTimeout(() => {
          if (currentCardIndex < cardLength - 1) {
            setCurrentCardIndex(i => i + 1);
          } else {
            setIsDeckFinished(true);
          }
        }, wasFlipped ? 280 : 0);
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const wasFlipped = isFlipped;
        setIsFlipped(false);
        setTimeout(() => {
          if (currentCardIndex > 0) {
            setCurrentCardIndex(i => i - 1);
          }
        }, wasFlipped ? 280 : 0);
      }
      if (e.code === 'Digit1') {
        if (!isFlipped) return;
        e.preventDefault();
        setUnknownCards(prev => new Set([...prev, activeCardIndex]));
        setKnownCards(prev => { const n = new Set(prev); n.delete(activeCardIndex); return n; });
        setIsFlipped(false);
        setTimeout(() => {
          if (currentCardIndex < cardLength - 1) {
            setCurrentCardIndex(i => i + 1);
          } else {
            setIsDeckFinished(true);
          }
        }, 280);
      }
      if (e.code === 'Digit2') {
        if (!isFlipped) return;
        e.preventDefault();
        setKnownCards(prev => new Set([...prev, activeCardIndex]));
        setUnknownCards(prev => { const n = new Set(prev); n.delete(activeCardIndex); return n; });
        setIsFlipped(false);
        setTimeout(() => {
          if (currentCardIndex < cardLength - 1) {
            setCurrentCardIndex(i => i + 1);
          } else {
            setIsDeckFinished(true);
          }
        }, 280);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeMaterial, isFlipped, currentCardIndex, isDeckFinished, cardOrder]);

  // Quiz helper functions
  const handleSelectQuizAnswer = (questionIdx, option) => {
    if (selectedAnswers[questionIdx] !== undefined) return; // Answered already
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIdx]: option,
    });
  };

  const handleNextQuiz = (quizLength) => {
    if (currentQuizIndex < quizLength - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      // Calculate score
      let correctCount = 0;
      activeMaterial.content.forEach((q, idx) => {
        const normalize = (s) => String(s || "").trim().toLowerCase();
        if (normalize(selectedAnswers[idx]) === normalize(q.answer)) {
          correctCount++;
        }
      });
      setQuizScore({
        correct: correctCount,
        total: quizLength,
      });
    }
  };

  const handleAskQuizChat = (questionIdx) => {
    if (!onAskQuestion || !activeMaterial?.content?.[questionIdx]) return;
    const q = activeMaterial.content[questionIdx];
    onAskQuestion(buildQuizChatPayload(q, { userAnswer: selectedAnswers[questionIdx] }));
  };

  const renderActiveMaterial = () => {
    if (!activeMaterial) return null;

    const { material_type, title, content } = activeMaterial;

    return (
      <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 p-4">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <button
            onClick={() => {
              setActiveMaterial(null);
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            ← Quay lại Studio
          </button>
          <div className="flex items-center gap-2 relative">
            {material_type === "flashcard" && (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
                  title="Tùy chọn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg z-50 text-left">
                      <button
                        onClick={() => {
                          setCurrentCardIndex(0);
                          setIsFlipped(false);
                          setKnownCards(new Set());
                          setUnknownCards(new Set());
                          setIsDeckFinished(false);
                          setCardOrder([...Array(content.length).keys()]);
                          setIsMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-0"
                      >
                        <svg className="stroke-current shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        Khởi động lại bộ
                      </button>
                      <button
                        onClick={() => {
                          const shuffled = [...Array(content.length).keys()].sort(() => Math.random() - 0.5);
                          setCardOrder(shuffled);
                          setCurrentCardIndex(0);
                          setIsFlipped(false);
                          setKnownCards(new Set());
                          setUnknownCards(new Set());
                          setIsDeckFinished(false);
                          setIsMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-0"
                      >
                        <svg className="stroke-current shrink-0 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 3h5v5M4 20l7-7M20 20l-7-7M4 4l16 16M16 21h5v-5" />
                        </svg>
                        Trộn bộ
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        disabled
                        className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-not-allowed border-0"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="stroke-current shrink-0 text-slate-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                          </svg>
                          Tải bộ xuống
                        </span>
                        <span className="text-[9px] text-slate-300 uppercase font-bold">Sắp có</span>
                      </button>
                      <button
                        disabled
                        className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-not-allowed border-0"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="stroke-current shrink-0 text-slate-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5v14" />
                          </svg>
                          Thêm thẻ thông tin mới
                        </span>
                        <span className="text-[9px] text-slate-300 uppercase font-bold">Sắp có</span>
                      </button>
                      <button
                        disabled
                        className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-not-allowed border-0"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="stroke-current shrink-0 text-slate-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Chỉnh sửa thẻ thông tin
                        </span>
                        <span className="text-[9px] text-slate-300 uppercase font-bold">Sắp có</span>
                      </button>
                      <button
                        disabled
                        className="flex w-full items-center justify-between rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-not-allowed border-0"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="stroke-current shrink-0 text-slate-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                          Xoá thẻ thông tin
                        </span>
                        <span className="text-[9px] text-slate-300 uppercase font-bold">Sắp có</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {material_type !== "flashcard" && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                {material_type === "quiz" ? "Trắc nghiệm" : "Bản đồ tư duy"}
              </span>
            )}
          </div>
        </header>

        <h3 className="m-0 text-sm font-bold text-slate-800 line-clamp-1 mb-4">{title}</h3>

        {/* Content Views */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {material_type === "flashcard" && (() => {
            const cardLength = cardOrder.length || 0;
            const activeCardIndex = cardOrder[currentCardIndex] !== undefined
              ? cardOrder[currentCardIndex]
              : currentCardIndex;

            if (isDeckFinished) {
              const knownCount = knownCards.size;
              const unknownCount = unknownCards.size;
              const skippedCount = content.length - knownCount - unknownCount;

              return (
                <div className="flex min-h-full flex-col items-center justify-center gap-6 pb-6 w-full">
                  <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm flex flex-col justify-between items-center text-center w-full min-h-[256px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lần tới bạn sẽ hiểu</span>

                    {/* Circle Stats & Count Grid */}
                    <div className="flex w-full items-center justify-around gap-4 mt-2 mb-4">
                      {/* Ring Progress */}
                      <div className="relative flex items-center justify-center">
                        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 112 112">
                          <circle
                            cx="56"
                            cy="56"
                            r="44"
                            className="stroke-slate-100"
                            strokeWidth="8"
                            fill="transparent"
                          />
                          <circle
                            cx="56"
                            cy="56"
                            r="44"
                            className="stroke-indigo-600 transition-all duration-500"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 44}
                            strokeDashoffset={2 * Math.PI * 44 * (1 - (content.length > 0 ? knownCount / content.length : 0))}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-black text-slate-800">{knownCount}/{content.length}</span>
                          <span className="text-[9px] font-semibold text-slate-400">{content.length > 0 ? Math.round((knownCount / content.length) * 100) : 0}%</span>
                        </div>
                      </div>

                      {/* Stats List */}
                      <div className="text-left space-y-2 text-xs font-semibold text-slate-600">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Tôi hiểu: <strong className="text-emerald-600 ml-1">{knownCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                          <span>Không hiểu: <strong className="text-red-600 ml-1">{unknownCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                          <span>Đã bỏ qua: <strong className="text-slate-500 ml-1">{skippedCount}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Dropdown Action Button */}
                    <div className="relative">
                      <button
                        onClick={() => setIsPracticeDropdownOpen(!isPracticeDropdownOpen)}
                        className="flex items-center gap-1.5 cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                      >
                        Luyện tập lại
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-200 ${isPracticeDropdownOpen ? "rotate-180" : ""}`}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {isPracticeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsPracticeDropdownOpen(false)} />
                          <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-48 rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg z-50 text-left">
                            <button
                              onClick={() => {
                                setCardOrder([...Array(content.length).keys()]);
                                setCurrentCardIndex(0);
                                setIsFlipped(false);
                                setKnownCards(new Set());
                                setUnknownCards(new Set());
                                setIsDeckFinished(false);
                                setIsPracticeDropdownOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-0"
                            >
                              Tất cả thẻ
                            </button>
                            <button
                              onClick={() => {
                                const remaining = cardOrder.filter(idx => !knownCards.has(idx));
                                if (remaining.length === 0) {
                                  setCardOrder([...Array(content.length).keys()]);
                                  setKnownCards(new Set());
                                } else {
                                  setCardOrder(remaining);
                                  const resetKnown = new Set(knownCards);
                                  remaining.forEach(idx => resetKnown.delete(idx));
                                  setKnownCards(resetKnown);
                                }
                                setCurrentCardIndex(0);
                                setIsFlipped(false);
                                setUnknownCards(new Set());
                                setIsDeckFinished(false);
                                setIsPracticeDropdownOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer border-0"
                            >
                              Chỉ các thẻ bạn chưa nhớ
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex min-h-full flex-col items-center justify-center gap-6 pb-6">
                {/* Card 3D container */}
                <div
                  className="group relative min-h-64 w-full cursor-pointer perspective-1000"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div
                    className={`card-flip-inner ${isFlipped ? "is-flipped" : ""}`}
                  >
                    {/* Front Side */}
                    <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-6 backface-hidden">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mặt Trước (Front)</span>
                      <div className="flex flex-1 items-center justify-center py-4 min-h-0">
                        <p className="m-0 text-center text-base font-semibold leading-relaxed text-slate-800 overflow-y-auto max-h-32">
                          {content[activeCardIndex]?.front}
                        </p>
                      </div>
                      <span className="text-center text-[11px] font-medium text-indigo-500">Chạm để xem câu trả lời</span>
                    </div>

                    {/* Back Side */}
                    <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-indigo-100 bg-indigo-900 p-6 backface-hidden rotate-y-180">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Mặt Sau (Back)</span>
                      <div className="flex flex-1 items-center justify-center py-4 min-h-0">
                        <p className="m-0 text-center text-base leading-relaxed text-white overflow-y-auto max-h-32">
                          {content[activeCardIndex]?.back}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-indigo-300">
                        {onAskQuestion ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const frontText = content[activeCardIndex]?.front || "";
                              const backText = content[activeCardIndex]?.back || "";
                              onAskQuestion(buildFlashcardChatPayload(frontText, backText));
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-950/40 px-3 py-1.5 text-[11px] font-bold text-indigo-200 hover:bg-indigo-950/80 hover:text-white transition cursor-pointer"
                          >
                            <svg className="stroke-current" width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Giải thích
                          </button>
                        ) : <span />}
                        <span>Chạm để quay lại câu hỏi</span>
                      </div>
                    </div>
                  </div>
                </div>



                {/* Progress & Navigation */}
                <div className="w-full text-center">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                    <span>Thẻ {currentCardIndex + 1} / {cardLength} (Đã biết: {knownCards.size})</span>
                    <span>{Math.round(((currentCardIndex + 1) / cardLength) * 100)}% hoàn thành</span>
                  </div>
                  <div className="mb-4 h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${((currentCardIndex + 1) / cardLength) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      disabled={currentCardIndex === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                        setTimeout(() => {
                          setCurrentCardIndex(currentCardIndex - 1);
                        }, isFlipped ? 280 : 0);
                      }}
                      className="flex h-9 w-16 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Trước
                    </button>

                    <button
                      disabled={!isFlipped}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFlipped) return;
                        setUnknownCards((prev) => {
                          const next = new Set(prev);
                          next.add(activeCardIndex);
                          return next;
                        });
                        setKnownCards((prev) => {
                          const next = new Set(prev);
                          next.delete(activeCardIndex);
                          return next;
                        });

                        setIsFlipped(false);
                        setTimeout(() => {
                          if (currentCardIndex < cardLength - 1) {
                            setCurrentCardIndex((i) => i + 1);
                          } else {
                            setIsDeckFinished(true);
                          }
                        }, 280);
                      }}
                      className={`flex h-9 items-center justify-center rounded-xl border px-4 text-xs font-bold transition cursor-pointer ${isFlipped ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                    >
                      ✗ Chưa biết
                    </button>
                    <button
                      disabled={!isFlipped}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isFlipped) return;
                        setKnownCards((prev) => {
                          const next = new Set(prev);
                          next.add(activeCardIndex);
                          return next;
                        });
                        setUnknownCards((prev) => {
                          const next = new Set(prev);
                          next.delete(activeCardIndex);
                          return next;
                        });

                        setIsFlipped(false);
                        setTimeout(() => {
                          if (currentCardIndex < cardLength - 1) {
                            setCurrentCardIndex((i) => i + 1);
                          } else {
                            setIsDeckFinished(true);
                          }
                        }, 280);
                      }}
                      className={`flex h-9 items-center justify-center rounded-xl border px-4 text-xs font-bold transition cursor-pointer ${isFlipped ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                    >
                      ✓ Đã biết
                    </button>

                    <button
                      disabled={cardLength === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        const wasFlipped = isFlipped;
                        setIsFlipped(false);
                        setTimeout(() => {
                          if (currentCardIndex === cardLength - 1) {
                            setIsDeckFinished(true);
                          } else {
                            setCurrentCardIndex(currentCardIndex + 1);
                          }
                        }, wasFlipped ? 280 : 0);
                      }}
                      className="flex h-9 w-16 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Sau
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-slate-400 mt-3.5 select-none">
                    Phím tắt: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">Space</kbd> lật thẻ · <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">←</kbd><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">→</kbd> điều hướng · <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">1</kbd> Chưa biết · <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">2</kbd> Đã biết
                  </p>
                </div>
              </div>
            );
          })()}

          {material_type === "quiz" && (
            <div className="flex h-full flex-col justify-between pb-6">
              {quizScore ? (
                /* Completed State */
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <QuizIcon size={32} />
                  </div>
                  <div>
                    <h4 className="m-0 text-lg font-bold text-slate-800">Kết quả ôn tập</h4>
                    <p className="mt-1 text-2xl font-black text-indigo-600">
                      {quizScore.correct} / {quizScore.total}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tỷ lệ chính xác: {Math.round((quizScore.correct / quizScore.total) * 100)}%
                    </p>
                  </div>
                  <div className="flex gap-2.5 mt-2 w-full justify-center">
                    <button
                      onClick={() => {
                        setCurrentQuizIndex(0);
                        setSelectedAnswers({});
                        setQuizScore(null);
                      }}
                      className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                    >
                      Làm lại bài kiểm tra
                    </button>
                    <button
                      onClick={() => {
                        setQuizScore(prev => ({ ...prev, reviewing: !prev?.reviewing }));
                      }}
                      className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                    >
                      {quizScore?.reviewing ? "Ẩn đáp án" : "Xem lại đáp án"}
                    </button>
                  </div>

                  {quizScore?.reviewing && (
                    <div className="space-y-3 mt-4 text-left w-full max-w-md mx-auto">
                      {content.map((q, idx) => {
                        const normalize = s => String(s || '').trim().toLowerCase();
                        const userAnswer = selectedAnswers[idx];
                        const isCorrect = normalize(userAnswer) === normalize(q.answer);
                        return (
                          <div key={idx} className={`rounded-xl border p-3.5 text-xs ${isCorrect ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'}`}>
                            <p className="font-bold text-slate-800 mb-2">{idx + 1}. {q.question}</p>
                            <p className="text-emerald-700 font-semibold">✓ Đáp án đúng: {q.answer}</p>
                            {!isCorrect && <p className="text-red-700 font-semibold">✗ Bạn chọn: {userAnswer || 'Không trả lời'}</p>}
                            {q.explanation && <p className="text-slate-600 mt-2 pt-2 border-t border-slate-100 leading-relaxed italic">{q.explanation}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Active Quiz Question */
                <div className="space-y-4">
                  {/* Progress info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Câu hỏi {currentQuizIndex + 1} / {content.length}</span>
                    <span>Điểm hiện tại: {Object.entries(selectedAnswers).filter(([idx, ans]) => {
                      const normalize = (s) => String(s || "").trim().toLowerCase();
                      return normalize(ans) === normalize(content[Number(idx)].answer);
                    }).length} đúng</span>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="m-0 text-sm font-bold text-slate-800 leading-relaxed">
                      {content[currentQuizIndex]?.question}
                    </p>
                  </div>

                  {onAskQuestion && (
                    <div className="flex justify-end -mt-2">
                      <button
                        type="button"
                        onClick={() => handleAskQuizChat(currentQuizIndex)}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                      >
                        <svg className="stroke-current" width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Hỏi chatbot
                      </button>
                    </div>
                  )}

                  {/* Options */}
                  <div className="grid gap-2">
                    {content[currentQuizIndex]?.options.map((opt, oIdx) => {
                      const isAnswered = selectedAnswers[currentQuizIndex] !== undefined;
                      const normalize = (s) => String(s || "").trim().toLowerCase();
                      const isSelected = normalize(selectedAnswers[currentQuizIndex]) === normalize(opt);
                      const isCorrect = normalize(content[currentQuizIndex]?.answer) === normalize(opt);

                      let btnStyle = "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
                      if (isAnswered) {
                        if (isCorrect) {
                          btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold";
                        } else if (isSelected) {
                          btnStyle = "border-red-500 bg-red-50 text-red-800 font-bold";
                        } else {
                          btnStyle = "border-slate-100 bg-slate-50/50 text-slate-400 opacity-60";
                        }
                      }

                      return (
                        <div
                          key={oIdx}
                          role="button"
                          tabIndex={isAnswered ? -1 : 0}
                          onClick={() => !isAnswered && handleSelectQuizAnswer(currentQuizIndex, opt)}
                          onKeyDown={(e) => {
                            if (!isAnswered && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              handleSelectQuizAnswer(currentQuizIndex, opt);
                            }
                          }}
                          className={`w-full text-left rounded-xl border p-3.5 text-xs font-medium leading-relaxed transition-all duration-200 flex items-start gap-2 select-text ${isAnswered ? "cursor-default" : "cursor-pointer"
                            } ${btnStyle}`}
                        >
                          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${isAnswered && isCorrect ? "bg-emerald-600 text-white border-emerald-600" : isAnswered && isSelected ? "bg-red-600 text-white border-red-600" : "border-slate-300 text-slate-500"
                            }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="flex-1 selection:bg-indigo-100">{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation (Shows when answered) */}
                  {(() => {
                    const userAnswer = selectedAnswers[currentQuizIndex];
                    if (userAnswer === undefined) return null;

                    const normalize = (s) => String(s || "").trim().toLowerCase();
                    const correctAnswer = content[currentQuizIndex]?.answer;
                    const options = content[currentQuizIndex]?.options || [];
                    const isUserCorrect = normalize(userAnswer) === normalize(correctAnswer);
                    const explanation = content[currentQuizIndex]?.explanation;

                    const correctOptionIndex = options.findIndex(opt => normalize(opt) === normalize(correctAnswer));
                    const correctLetter = correctOptionIndex !== -1
                      ? String.fromCharCode(65 + correctOptionIndex)
                      : "";

                    return (
                      <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3.5 text-xs text-indigo-950 animate-fadeIn select-text">
                        {!isUserCorrect ? (
                          <>
                            <p className="m-0 font-bold text-indigo-900 mb-1">
                              💡 Đáp án đúng: <span className="text-emerald-700 font-bold selection:bg-indigo-100">{correctLetter || correctAnswer}</span>
                            </p>
                            {explanation && (
                              <p className="m-0 mt-2 pt-2 border-t border-indigo-100/50 leading-relaxed text-slate-700 selection:bg-indigo-100">
                                {explanation}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="m-0 font-bold text-indigo-900 mb-1">💡 Giải thích:</p>
                            <p className="m-0 leading-relaxed text-slate-700 selection:bg-indigo-100">
                              {explanation || "Chính xác! Bạn đã chọn đúng đáp án."}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Navigation */}
                  <div className="flex justify-end pt-2">
                    <button
                      disabled={selectedAnswers[currentQuizIndex] === undefined}
                      onClick={() => handleNextQuiz(content.length)}
                      className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {currentQuizIndex === content.length - 1 ? "Hoàn thành" : "Câu tiếp theo →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {material_type === "mindmap" && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              {/* Add expand/collapse controls */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 select-none">
                <span className="text-xs font-bold text-slate-500">Bản đồ tư duy</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMindmapAllOpen(true)}
                    className="text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer border-0 bg-transparent"
                  >
                    Mở rộng tất cả
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setMindmapAllOpen(false)}
                    className="text-[10px] font-semibold text-slate-500 hover:underline cursor-pointer border-0 bg-transparent"
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div style={{ minWidth: '320px' }}>
                  <MindmapNode node={content} forceOpen={mindmapAllOpen} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    return (
      <div className="flex h-full flex-col overflow-hidden p-4">
        {/* Studio Title */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <SparklesIcon size={16} className="text-indigo-600" />
            Studio
          </h3>
        </div>

        {/* Generate Tiles Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Flashcard Tile */}
          <button
            onClick={() => handleGenerate("flashcard")}
            disabled={!selectedDocument || isGenerating}
            className="group flex flex-col justify-between items-start text-left cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="rounded-lg bg-rose-50 p-2 text-rose-500 group-hover:scale-105 transition">
              <FlashcardIcon size={18} />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-800">Thẻ ghi nhớ</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">{STUDIO_MATERIAL_COUNTS.flashcard} cặp thẻ Front/Back</p>
            </div>
          </button>

          {/* Quiz Tile */}
          <button
            onClick={() => handleGenerate("quiz")}
            disabled={!selectedDocument || isGenerating}
            className="group flex flex-col justify-between items-start text-left cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-500 group-hover:scale-105 transition">
              <QuizIcon size={18} />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-800">Bài kiểm tra</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">{STUDIO_MATERIAL_COUNTS.quiz} câu hỏi MCQ tự ôn</p>
            </div>
          </button>

          {/* Mindmap Tile - Locked / Coming Soon */}
          <div className="flex flex-col justify-between items-start border border-dashed border-slate-200 bg-slate-50/60 p-3 rounded-xl opacity-60">
            <div className="flex items-center justify-between w-full">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-500">
                <MindmapIcon size={18} />
              </div>
              <LockIcon className="text-slate-400" />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-500">Bản đồ tư duy</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">Sơ đồ tóm tắt cấu trúc</p>
            </div>
          </div>

          {/* Roadmap Tile */}
          <button
            onClick={() => {
              setActiveMaterial(null);
              setError(null);
              setIsRoadmapOpen(true);
            }}
            disabled={!selectedDocument}
            className="group flex flex-col justify-between items-start text-left cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 group-hover:scale-105 transition">
              <RoadmapIcon size={18} />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-800">Lộ trình học</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">Giai đoạn & nhiệm vụ</p>
            </div>
          </button>
        </div>

        {/* Generated materials list */}
        <div className="min-h-0 flex-1 overflow-y-auto mt-6">
          <h4 className="m-0 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tài liệu học tập đã tạo</h4>

          {isLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : materials.length > 0 ? (
            <ul className="m-0 list-none p-0 space-y-2.5">
              {materials.map((m) => (
                <li key={m.id}>
                  <div
                    onClick={() => handleOpenMaterial(m)}
                    className="w-full text-left cursor-pointer rounded-xl border border-slate-100 bg-white p-3 hover:border-indigo-100 hover:bg-indigo-50/20 shadow-sm transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${m.material_type === "flashcard" ? "bg-rose-50 text-rose-500" : m.material_type === "quiz" ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                        }`}>
                        {m.material_type === "flashcard" && <FlashcardIcon size={15} />}
                        {m.material_type === "quiz" && <QuizIcon size={15} />}
                        {m.material_type === "mindmap" && <MindmapIcon size={15} />}
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-bold text-slate-800 truncate leading-snug">{m.title}</p>
                        <p className="m-0 text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <ClockIcon size={10} />
                          {new Date(m.created_at).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteClick(m.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-red-500 rounded bg-transparent border-0 cursor-pointer text-slate-400"
                      title="Xóa tài liệu"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400 leading-relaxed">
              {selectedDocument
                ? "Chưa có tài liệu ôn tập nào được tạo. Hãy nhấn vào các thẻ công cụ ở trên để tạo!"
                : "Chọn một tài liệu trong thư viện để khám phá Studio."}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm relative ${className}`}
      style={width ? { width } : undefined}
    >
      {/* Loading state cover */}
      {isGenerating && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 p-6 text-center animate-fadeIn">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            {/* Spinning pulse */}
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-100 opacity-75" />
            <div className="relative rounded-full bg-indigo-50 p-4 text-indigo-600 animate-spin">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </div>
          </div>
          <p className="m-0 text-sm font-bold text-slate-800 leading-snug">{loadingStateText}</p>
          <p className="m-0 mt-1.5 text-xs text-slate-500">Mô hình AI đang làm việc chăm chỉ, vui lòng chờ trong giây lát...</p>
        </div>
      )}

      {error && (
        <div className="p-3 border-b border-red-100 bg-red-50 text-xs font-semibold text-red-700 flex items-center justify-between">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer border-0 bg-transparent text-slate-400 hover:text-slate-600 text-sm pl-2">×</button>
        </div>
      )}

      {isRoadmapOpen ? (
        <WorkspaceRoadmapPanel
          selectedDocument={selectedDocument}
          onClose={() => setIsRoadmapOpen(false)}
          onGoToPage={onGoToPage}
        />
      ) : activeMaterial ? (
        renderActiveMaterial()
      ) : (
        renderDashboard()
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h4 className="m-0 text-sm font-bold text-slate-800">Xác nhận xóa</h4>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">Bạn có chắc chắn muốn xóa tài liệu học tập này? Hành động này không thể hoàn tác.</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  try {
                    await deleteStudyMaterial(id);
                    setMaterials(materials.filter((m) => m.id !== id));
                    if (activeMaterial?.id === id) {
                      setActiveMaterial(null);
                    }
                  } catch {
                    setError("Xóa tài liệu học tập thất bại.");
                  }
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
              >
                Xóa tài liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
