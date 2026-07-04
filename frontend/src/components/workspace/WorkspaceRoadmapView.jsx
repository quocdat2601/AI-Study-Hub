import React, { useState, useEffect, useCallback } from "react";
import { getDocumentRoadmap, retryDocumentRoadmap, toggleRoadmapStep } from "../../services/aiApi.js";

function RoadmapIcon({ className, size = 20 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function CheckIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function buildStepChatPayload(step) {
  const displayText = `Tôi đang học theo lộ trình của tài liệu này và đến bước ${step.order}: "${step.heading}".

Mục tiêu của bước: ${step.description || "Chưa có mô tả"}

Hãy giảng giải phần này cho tôi dựa trên nội dung tài liệu.`;
  const questionForApi = `${displayText}

[studio-roadmap-meta]
Bước ${step.order}: ${step.heading}
Mục tiêu: ${step.description || "Chưa có"}
Yêu cầu: Dựa trên nội dung tài liệu nguồn, giải thích chi tiết phần "${step.heading}", nêu các ý chính người học cần nắm và ví dụ minh họa nếu tài liệu có.`;
  return { displayText, question: questionForApi };
}

function buildSuggestedQuestionPayload(step, questionText) {
  const questionForApi = `${questionText}

[studio-roadmap-meta]
Câu hỏi gợi ý thuộc bước ${step.order}: ${step.heading} trong lộ trình học. Trả lời dựa trên nội dung tài liệu nguồn.`;
  return { displayText: questionText, question: questionForApi };
}

// Người dùng chỉ thấy thông báo thân thiện; lỗi thô (JSON provider, stack) vẫn nằm trong DB để debug
function friendlyGenerationError(raw) {
  const text = String(raw || "");
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(text)) {
    return "Mô hình AI đang quá tải, vui lòng thử lại sau ít phút.";
  }
  if (/timed?\s*out|timeout|504/i.test(text)) {
    return "Yêu cầu AI quá thời gian chờ. Hãy thử lại hoặc chọn mô hình khác.";
  }
  if (/429|quota|rate.?limit|limit reached|exceeded/i.test(text)) {
    return "Đã chạm giới hạn lượt dùng AI hôm nay. Hãy thử lại sau.";
  }
  if (/api key/i.test(text)) {
    return "API key Gemini chưa được cấu hình đúng. Hãy kiểm tra backend/.env.";
  }
  if (/connect|connection refused|fetch failed|ECONNREFUSED/i.test(text)) {
    return "Không kết nối được dịch vụ AI. Hãy kiểm tra Ollama/mạng rồi thử lại.";
  }
  return "Tạo lộ trình học thất bại. Vui lòng thử lại.";
}

const PENDING_POLL_INTERVAL_MS = 5000;

export default function WorkspaceRoadmapView({ selectedDocument, onAskQuestion, onPrepareQuestion }) {
  const [roadmap, setRoadmap] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  // Tick mục tiêu là tự đánh giá cục bộ trong phiên xem, không persist — key "stepOrder:objIdx"
  const [objectiveTicks, setObjectiveTicks] = useState(new Set());
  const [confirmRegen, setConfirmRegen] = useState(false);

  const loadRoadmap = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await getDocumentRoadmap(selectedDocument.id);
      setRoadmap(data.roadmap);
      setCompletedSteps(data.completedSteps || []);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.error || "Không thể tải lộ trình học.");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [selectedDocument]);

  useEffect(() => {
    setObjectiveTicks(new Set());
    setConfirmRegen(false);
    if (selectedDocument) {
      loadRoadmap();
    } else {
      setRoadmap(null);
      setCompletedSteps([]);
    }
  }, [selectedDocument, loadRoadmap]);

  // Roadmap sinh nền sau upload — tự cập nhật khi đang pending thay vì bắt user bấm tải lại
  useEffect(() => {
    if (roadmap?.status !== "pending") return undefined;
    const timer = setInterval(() => {
      loadRoadmap({ silent: true });
    }, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [roadmap?.status, loadRoadmap]);

  async function handleGenerate() {
    if (!selectedDocument) return;
    setIsGenerating(true);
    setError(null);
    try {
      const data = await retryDocumentRoadmap(selectedDocument.id);
      setRoadmap(data.roadmap);
      setCompletedSteps([]);
      setObjectiveTicks(new Set());
      if (data.roadmap?.status === "failed") {
        setError(friendlyGenerationError(data.roadmap.error));
      }
    } catch (err) {
      setError(friendlyGenerationError(err.response?.data?.error || err.message));
    } finally {
      setIsGenerating(false);
    }
  }

  // Điền sẵn câu hỏi vào ô chat để user tự bấm gửi (tránh đốt AI call vì click nhầm);
  // fallback gửi thẳng nếu nơi nhúng không truyền onPrepareQuestion
  function askOrPrepare(displayText, payload) {
    if (onPrepareQuestion) {
      onPrepareQuestion(displayText);
    } else if (onAskQuestion) {
      onAskQuestion(payload);
    }
  }

  function toggleObjective(stepOrder, objectiveIndex) {
    const key = `${stepOrder}:${objectiveIndex}`;
    setObjectiveTicks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleToggleStep(stepOrder) {
    const wasCompleted = completedSteps.includes(stepOrder);
    const previous = completedSteps;
    setCompletedSteps(
      wasCompleted ? previous.filter((order) => order !== stepOrder) : [...previous, stepOrder]
    );
    try {
      const data = await toggleRoadmapStep(selectedDocument.id, stepOrder, !wasCompleted);
      setCompletedSteps(data.completedSteps || []);
    } catch (err) {
      setCompletedSteps(previous);
      setError(err.response?.data?.error || "Cập nhật tiến độ thất bại.");
    }
  }

  const steps = roadmap?.status === "ready" || roadmap?.status === "stale"
    ? roadmap.steps || []
    : [];
  const completedCount = steps.filter((step) => completedSteps.includes(step.order)).length;
  const progressPercent = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const nextStep = steps.find((step) => !completedSteps.includes(step.order));
  const isAllCompleted = steps.length > 0 && completedCount === steps.length;

  const renderEmptyState = (message, showGenerateButton) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
      <div className="rounded-full bg-indigo-50 p-3 text-indigo-500">
        <RoadmapIcon size={24} />
      </div>
      <p className="m-0 text-xs text-slate-400 leading-relaxed">{message}</p>
      {showGenerateButton && (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Tạo lộ trình học
        </button>
      )}
    </div>
  );

  const renderBody = () => {
    if (!selectedDocument) {
      return renderEmptyState("Chọn một tài liệu trong thư viện để xem lộ trình học.", false);
    }

    if (isLoading) {
      return (
        <div className="space-y-2 py-4">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
        </div>
      );
    }

    if (!roadmap) {
      return renderEmptyState(
        "Chưa có lộ trình học cho tài liệu này. Nhấn nút bên dưới để AI phân tích tài liệu và đề xuất thứ tự học.",
        true
      );
    }

    if (roadmap.status === "pending") {
      return renderEmptyState(
        <>
          Lộ trình đang được tạo tự động — trang sẽ tự cập nhật khi hoàn tất.
          <button
            onClick={() => loadRoadmap()}
            className="ml-1 cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-indigo-600 hover:underline"
          >
            Tải lại ngay
          </button>
        </>,
        false
      );
    }

    if (roadmap.status === "failed") {
      return renderEmptyState("Tạo lộ trình học chưa thành công. Hãy thử tạo lại.", true);
    }

    return (
      <>
        {roadmap.status === "stale" && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
            <span>Tài liệu đã được xử lý lại — lộ trình này có thể đã cũ.</span>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="shrink-0 cursor-pointer rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition"
            >
              Tạo lại
            </button>
          </div>
        )}

        {/* Progress header */}
        <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h4 className="m-0 text-sm font-bold text-slate-800 line-clamp-2">{roadmap.title}</h4>
          {roadmap.goal && (
            <p className="m-0 mt-2 flex items-start gap-1.5 rounded-lg bg-indigo-50/60 p-2.5 text-[11px] font-medium leading-relaxed text-indigo-900">
              <span aria-hidden="true">🎯</span>
              <span>{roadmap.goal}</span>
            </p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Hoàn thành {completedCount} / {steps.length} bước</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isAllCompleted ? "bg-emerald-500" : "bg-indigo-600"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {isAllCompleted && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center animate-fadeIn">
            <p className="m-0 text-sm font-bold text-emerald-800">🎉 Chúc mừng! Bạn đã hoàn thành toàn bộ lộ trình.</p>
            <p className="m-0 mt-1 text-[11px] leading-relaxed text-emerald-700">
              Hãy sang tab Học liệu tạo bài kiểm tra hoặc thẻ ghi nhớ để củng cố lại toàn bộ kiến thức.
            </p>
          </div>
        )}

        {!isAllCompleted && (
          <p className="m-0 mb-3 px-1 text-[10px] leading-relaxed text-slate-400">
            Cách học: đi lần lượt từng bước — đọc phần tương ứng trong tài liệu bên trái, dùng câu
            hỏi gợi ý hoặc &quot;Học bước này với AI&quot; khi chưa rõ, tự đánh giá theo mục tiêu rồi
            bấm vòng tròn số để đánh dấu hoàn thành.
          </p>
        )}

        {/* Steps timeline */}
        <ol className="m-0 list-none p-0 space-y-2.5">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.order);
            const isNext = !isCompleted && nextStep?.order === step.order;
            const isLast = index === steps.length - 1;
            const objectives = step.objectives || [];
            const allObjectivesMet = !isCompleted
              && objectives.length > 0
              && objectives.every((_, oIdx) => objectiveTicks.has(`${step.order}:${oIdx}`));
            return (
              <li key={step.order} className="relative pl-9">
                {!isLast && (
                  <span className="absolute left-[13px] top-8 bottom-[-10px] w-px bg-slate-200" aria-hidden="true" />
                )}
                <button
                  onClick={() => handleToggleStep(step.order)}
                  title={isCompleted ? "Bỏ đánh dấu hoàn thành" : "Đánh dấu hoàn thành"}
                  className={`absolute left-0 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition cursor-pointer ${isCompleted
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : allObjectivesMet
                      ? "border-emerald-500 bg-white text-emerald-600 ring-2 ring-emerald-200"
                      : isNext
                        ? "border-indigo-500 bg-white text-indigo-600 ring-2 ring-indigo-100"
                        : "border-slate-300 bg-white text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
                    }`}
                >
                  {isCompleted ? <CheckIcon /> : step.order}
                </button>
                <div
                  className={`rounded-xl border p-3.5 shadow-sm transition ${isCompleted
                    ? "border-indigo-100 bg-indigo-50/40"
                    : isNext
                      ? "border-indigo-300 bg-white ring-1 ring-indigo-100"
                      : "border-slate-100 bg-white"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`m-0 text-xs font-bold leading-snug ${isCompleted ? "text-slate-500 line-through" : "text-slate-800"}`}>
                      {step.heading}
                    </p>
                    {isNext && (
                      <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600">
                        Tiếp theo
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-500">
                      {step.description}
                    </p>
                  )}
                  {objectives.length > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                      <p className="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Mục tiêu cần đạt
                      </p>
                      <ul className="m-0 list-none p-0 space-y-1.5">
                        {objectives.map((objective, oIdx) => {
                          const ticked = isCompleted || objectiveTicks.has(`${step.order}:${oIdx}`);
                          return (
                            <li key={oIdx}>
                              <button
                                onClick={() => !isCompleted && toggleObjective(step.order, oIdx)}
                                className={`flex w-full items-start gap-1.5 border-0 bg-transparent p-0 text-left ${isCompleted ? "cursor-default" : "cursor-pointer"}`}
                              >
                                <span className={`mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${ticked
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white hover:border-emerald-400"
                                  }`}
                                >
                                  {ticked && <CheckIcon size={9} />}
                                </span>
                                <span className={`text-[11px] leading-snug ${ticked ? "text-slate-400" : "text-slate-600"}`}>
                                  {objective}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {allObjectivesMet && (
                        <p className="m-0 mt-2 text-[10px] font-semibold text-emerald-600">
                          Bạn đã tự đánh giá đạt đủ mục tiêu — bấm vòng tròn số {step.order} để hoàn thành bước này!
                        </p>
                      )}
                    </div>
                  )}
                  {(onAskQuestion || onPrepareQuestion) && !isCompleted && (step.questions || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.questions.map((questionText, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => askOrPrepare(questionText, buildSuggestedQuestionPayload(step, questionText))}
                          title="Điền câu hỏi này vào ô chat"
                          className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-[10px] font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                        >
                          {questionText}
                        </button>
                      ))}
                    </div>
                  )}
                  {(onAskQuestion || onPrepareQuestion) && !isCompleted && (
                    <button
                      onClick={() => askOrPrepare(buildStepChatPayload(step).displayText, buildStepChatPayload(step))}
                      className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                    >
                      <svg className="stroke-current" width="11" height="11" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Học bước này với AI
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden p-4">
      {isGenerating && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 p-6 text-center animate-fadeIn">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-100 opacity-75" />
            <div className="relative rounded-full bg-indigo-50 p-4 text-indigo-600 animate-spin">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </div>
          </div>
          <p className="m-0 text-sm font-bold text-slate-800 leading-snug">Đang phân tích tài liệu và xây dựng lộ trình học...</p>
          <p className="m-0 mt-1.5 text-xs text-slate-500">Mô hình AI đang làm việc chăm chỉ, vui lòng chờ trong giây lát...</p>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="m-0 text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <RoadmapIcon size={16} className="text-indigo-600" />
          Lộ trình học
        </h3>
        {roadmap?.status === "ready" && !isGenerating && (
          confirmRegen ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-500">Tạo lại từ đầu?</span>
              <button
                onClick={() => {
                  setConfirmRegen(false);
                  handleGenerate();
                }}
                className="cursor-pointer rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 transition"
              >
                Đồng ý
              </button>
              <button
                onClick={() => setConfirmRegen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRegen(true)}
              title="Tạo lại lộ trình"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer border-0 bg-transparent pl-2 text-sm text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 flex flex-col">
        {renderBody()}
      </div>
    </div>
  );
}
