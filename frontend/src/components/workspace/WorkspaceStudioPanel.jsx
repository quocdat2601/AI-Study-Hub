import React, { useState, useEffect, useCallback } from "react";
import { getStudyMaterials, generateStudyMaterial, deleteStudyMaterial } from "../../services/aiApi.js";
import { SparklesIcon, ClockIcon } from "./WorkspaceIcons.jsx";

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

function LockIcon({ className, size = 16 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Tree view for Mindmap
function MindmapNode({ node, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

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
            <MindmapNode key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceStudioPanel({ selectedDocument, selectedModel, width, onAskQuestion, className = "" }) {
  const [materials, setMaterials] = useState([]);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStateText, setLoadingStateText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardOrder, setCardOrder] = useState([]);
  const [knownCards, setKnownCards] = useState(new Set());

  // Quiz state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionIdx]: selectedOptionString }
  const [quizScore, setQuizScore] = useState(null);

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
    } else {
      setMaterials([]);
      setActiveMaterial(null);
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
      }
      setCurrentQuizIndex(0);
      setSelectedAnswers({});
      setQuizScore(null);
    } catch (err) {
      setError(err.response?.data?.error || "Tạo tài liệu học tập thất bại. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài liệu học tập này?")) return;

    try {
      await deleteStudyMaterial(id);
      setMaterials(materials.filter((m) => m.id !== id));
      if (activeMaterial?.id === id) {
        setActiveMaterial(null);
      }
    } catch {
      setError("Xóa tài liệu học tập thất bại.");
    }
  }

  function handleOpenMaterial(material) {
    setActiveMaterial(material);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    if (material && material.material_type === "flashcard" && material.content) {
      setCardOrder([...Array(material.content.length).keys()]);
      setKnownCards(new Set());
    }
    setCurrentQuizIndex(0);
    setSelectedAnswers({});
    setQuizScore(null);
  }

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

  const renderActiveMaterial = () => {
    if (!activeMaterial) return null;

    const { material_type, title, content } = activeMaterial;

    return (
      <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 p-4">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveMaterial(null)}
            className="flex items-center gap-1 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            ← Quay lại Studio
          </button>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
              {material_type === "flashcard" ? "Flashcards" : material_type === "quiz" ? "Trắc nghiệm" : "Bản đồ tư duy"}
            </span>
          </div>
        </header>

        <h3 className="m-0 text-sm font-bold text-slate-800 line-clamp-1 mb-4">{title}</h3>

        {/* Content Views */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {material_type === "flashcard" && (() => {
            const cardLength = content?.length || 0;
            const activeCardIndex = (cardOrder.length === cardLength && cardOrder[currentCardIndex] !== undefined)
              ? cardOrder[currentCardIndex]
              : currentCardIndex;

            return (
              <div className="flex h-full flex-col items-center justify-between gap-6 pb-6">
                {/* Card 3D container */}
                <div
                  className="group relative h-64 w-full cursor-pointer perspective-1000"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div
                    className={`card-flip-inner ${isFlipped ? "is-flipped" : ""}`}
                  >
                    {/* Front Side */}
                    <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-indigo-100 bg-white p-6 backface-hidden">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mặt Trước (Front)</span>
                      <div className="flex flex-1 items-center justify-center py-4">
                        <p className="m-0 text-center text-base font-semibold leading-relaxed text-slate-800">
                          {content[activeCardIndex]?.front}
                        </p>
                      </div>
                      <span className="text-center text-[11px] font-medium text-indigo-500">Chạm để xem câu trả lời</span>
                    </div>

                    {/* Back Side */}
                    <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-indigo-100 bg-indigo-900 p-6 backface-hidden rotate-y-180">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Mặt Sau (Back)</span>
                      <div className="flex flex-1 items-center justify-center py-4">
                        <p className="m-0 text-center text-base leading-relaxed text-white">
                          {content[activeCardIndex]?.back}
                        </p>
                      </div>

                      {/* Self-Assessment Row */}
                      <div className="flex items-center justify-center gap-3 my-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFlipped(false);
                            if (currentCardIndex < content.length - 1) {
                              setTimeout(() => {
                                setCurrentCardIndex((i) => i + 1);
                              }, 280);
                            }
                          }}
                          className="rounded-lg border border-red-700 bg-red-950/30 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-950/60 transition cursor-pointer"
                        >
                          ✗ Chưa biết
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setKnownCards((prev) => {
                              const next = new Set(prev);
                              next.add(activeCardIndex);
                              return next;
                            });
                            setIsFlipped(false);
                            if (currentCardIndex < content.length - 1) {
                              setTimeout(() => {
                                setCurrentCardIndex((i) => i + 1);
                              }, 280);
                            }
                          }}
                          className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-950/60 transition cursor-pointer"
                        >
                          ✓ Đã biết
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-indigo-300">
                        {onAskQuestion ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const frontText = content[activeCardIndex]?.front || "";
                              const backText = content[activeCardIndex]?.back || "";
                              const promptText = `Tôi đang xem lại các thẻ thông tin dựa trên tài liệu nguồn và muốn hiểu sâu hơn về một trong những thẻ này.\n\nNội dung ở mặt trước: "${frontText}"\nCâu trả lời ở mặt sau: "${backText}"\n\nHãy giải thích chủ đề này chi tiết hơn.`;
                              onAskQuestion(promptText);
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
                    <span>Thẻ {currentCardIndex + 1} / {content.length} (Đã biết: {knownCards.size})</span>
                    <span>{Math.round(((currentCardIndex + 1) / content.length) * 100)}% hoàn thành</span>
                  </div>
                  <div className="mb-4 h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${((currentCardIndex + 1) / content.length) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      disabled={currentCardIndex === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isFlipped) {
                          setIsFlipped(false);
                          setTimeout(() => {
                            setCurrentCardIndex(currentCardIndex - 1);
                          }, 280);
                        } else {
                          setCurrentCardIndex(currentCardIndex - 1);
                        }
                      }}
                      className="flex h-9 w-16 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Trước
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const shuffled = [...Array(content.length).keys()].sort(() => Math.random() - 0.5);
                        setCardOrder(shuffled);
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                        setKnownCards(new Set());
                      }}
                      className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      🔀 Trộn thẻ
                    </button>
                    <button
                      disabled={currentCardIndex === content.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isFlipped) {
                          setIsFlipped(false);
                          setTimeout(() => {
                            setCurrentCardIndex(currentCardIndex + 1);
                          }, 280);
                        } else {
                          setCurrentCardIndex(currentCardIndex + 1);
                        }
                      }}
                      className="flex h-9 w-16 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Sau
                    </button>
                  </div>
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
                  <button
                    onClick={() => {
                      setCurrentQuizIndex(0);
                      setSelectedAnswers({});
                      setQuizScore(null);
                    }}
                    className="mt-2 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    Làm lại bài kiểm tra
                  </button>
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
                        <button
                          key={oIdx}
                          disabled={isAnswered}
                          onClick={() => handleSelectQuizAnswer(currentQuizIndex, opt)}
                          className={`w-full text-left cursor-pointer rounded-xl border p-3.5 text-xs font-medium leading-relaxed transition-all duration-200 flex items-start gap-2 ${btnStyle}`}
                        >
                          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${isAnswered && isCorrect ? "bg-emerald-600 text-white border-emerald-600" : isAnswered && isSelected ? "bg-red-600 text-white border-red-600" : "border-slate-300 text-slate-500"
                            }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation (Shows when answered) */}
                  {selectedAnswers[currentQuizIndex] !== undefined && (
                    <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3.5 text-xs text-indigo-950 animate-fadeIn">
                      <p className="m-0 font-bold text-indigo-900 mb-1">💡 Giải thích:</p>
                      <p className="m-0 leading-relaxed">{content[currentQuizIndex]?.explanation}</p>
                    </div>
                  )}

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
              <div className="overflow-x-auto">
                <div style={{ minWidth: '320px' }}>
                  <MindmapNode node={content} />
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
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">10 cặp thẻ Front/Back</p>
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
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">5 câu hỏi MCQ tự ôn</p>
            </div>
          </button>

          {/* Mindmap Tile */}
          <button
            onClick={() => handleGenerate("mindmap")}
            disabled={!selectedDocument || isGenerating}
            className="group flex flex-col justify-between items-start text-left cursor-pointer rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-500 group-hover:scale-105 transition">
              <MindmapIcon size={18} />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-800">Bản đồ tư duy</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">Sơ đồ tóm tắt cấu trúc</p>
            </div>
          </button>

          {/* Locked / Coming Soon Tile 1 */}
          <div className="flex flex-col justify-between items-start border border-dashed border-slate-200 bg-slate-50/60 p-3 rounded-xl opacity-60">
            <div className="flex items-center justify-between w-full">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-500">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <LockIcon className="text-slate-400" />
            </div>
            <div className="mt-4">
              <p className="m-0 text-xs font-bold text-slate-500">Tổng quan audio</p>
              <p className="m-0 mt-0.5 text-[9.5px] text-slate-400">Audio podcast thảo luận</p>
            </div>
          </div>
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
                  <button
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
                      onClick={(e) => handleDelete(m.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-red-500 rounded bg-transparent border-0 cursor-pointer text-slate-400"
                      title="Xóa tài liệu"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </button>
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

      {activeMaterial ? renderActiveMaterial() : renderDashboard()}
    </aside>
  );
}
