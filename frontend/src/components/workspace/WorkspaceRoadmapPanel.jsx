import React, { useEffect, useMemo, useState } from "react";
import { getRoadmap, generateRoadmap, updateRoadmapTask } from "../../services/roadmapApi.js";

function getRoadmapError(err, fallback) {
  if (err?.code === "ECONNABORTED") {
    return "Tạo lộ trình mất quá nhiều thời gian. Hãy đợi thêm hoặc thử lại sau vài giây.";
  }
  return err?.response?.data?.error || err?.message || fallback;
}

const TASK_TYPE_LABELS = {
  read: "Đọc",
  note: "Ghi chú",
  flashcard: "Flashcard",
  quiz: "Quiz",
  review: "Ôn tập",
};

const MILESTONE_STATUS = {
  done: { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  active: { label: "Đang học", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  upcoming: { label: "Chưa bắt đầu", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

function isTaskDone(task) {
  return String(task?.status || "").toLowerCase() === "done";
}

function formatEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return "";
  const { pageStart, pageEnd } = evidence;
  const start = Number(pageStart);
  const end = Number(pageEnd);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return start === end ? `Trang ${start}` : `Trang ${start}-${end}`;
  }
  return "";
}

function getTaskPage(task) {
  const start = Number(task?.evidence?.pageStart);
  if (Number.isFinite(start) && start >= 1) return start;
  return null;
}

function buildRoadmapProgress(milestones) {
  const allTasks = milestones.flatMap((m) => m.tasks || []);
  const done = allTasks.filter(isTaskDone).length;
  const total = allTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  let currentTaskId = null;
  let activeMilestoneIndex = milestones.length ? 0 : -1;

  for (let i = 0; i < milestones.length; i += 1) {
    const tasks = milestones[i].tasks || [];
    const milestoneDone = tasks.length > 0 && tasks.every(isTaskDone);
    if (!milestoneDone) {
      activeMilestoneIndex = i;
      const nextTask = tasks.find((t) => !isTaskDone(t));
      if (nextTask) {
        currentTaskId = nextTask.id;
        break;
      }
    }
  }

  if (currentTaskId == null && total > 0 && done === total) {
    activeMilestoneIndex = milestones.length - 1;
  }

  const milestoneMeta = milestones.map((milestone, index) => {
    const tasks = milestone.tasks || [];
    const completed = tasks.filter(isTaskDone).length;
    const milestoneTotal = tasks.length;
    let status = "upcoming";
    if (milestoneTotal > 0 && completed === milestoneTotal) status = "done";
    else if (index === activeMilestoneIndex) status = "active";
    return { status, completed, total: milestoneTotal };
  });

  return { done, total, pct, currentTaskId, milestoneMeta };
}

function ProgressBar({ pct, done, total }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs font-bold text-slate-800">Tiến độ học</p>
        <p className="m-0 text-[10px] font-semibold text-indigo-600">
          {done}/{total} · {pct}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 ? (
        <p className="m-0 mt-2 text-[10px] font-semibold text-emerald-600">Chúc mừng — bạn đã hoàn thành lộ trình!</p>
      ) : (
        <p className="m-0 mt-2 text-[10px] text-slate-500">Tick từng nhiệm vụ để đánh dấu bạn đã học tới đâu.</p>
      )}
    </div>
  );
}

function RoadmapCheckbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
    />
  );
}

function TaskRow({ task, onToggle, isCurrent, onGoToPage }) {
  const done = isTaskDone(task);
  const evidenceText = formatEvidence(task?.evidence);
  const typeLabel = TASK_TYPE_LABELS[String(task?.type || "").toLowerCase()] || null;
  const page = getTaskPage(task);
  const canJumpToPage = Boolean(page && onGoToPage);

  function handleOpenPage() {
    if (!canJumpToPage) return;
    onGoToPage(page);
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-200 ${
        done
          ? "border-emerald-100 bg-emerald-50/40"
          : isCurrent
            ? "border-indigo-300 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200"
            : "border-slate-100 bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <RoadmapCheckbox checked={done} onChange={() => onToggle(task)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isCurrent && !done ? (
                <span className="inline-flex items-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Đang học
                </span>
              ) : null}
              {done ? (
                <span className="inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Xong
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleOpenPage}
              disabled={!canJumpToPage}
              className={`m-0 mt-1 block w-full text-left text-xs font-bold transition ${
                done ? "text-slate-400 line-through" : "text-slate-800"
              } ${canJumpToPage ? "cursor-pointer hover:text-indigo-700" : "cursor-default"}`}
            >
              {task?.title || "Nhiệm vụ"}
            </button>
            <p className={`m-0 mt-0.5 text-[10px] ${done ? "text-slate-300" : "text-slate-400"}`}>
              {[typeLabel, evidenceText, task?.estimatedMinutes ? `${task.estimatedMinutes} phút` : ""]
                .filter(Boolean)
                .join(" · ")}
              {canJumpToPage ? " · Bấm tiêu đề để mở trang" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerateRoadmapForm({ goal, setGoal, isGenerating, onGenerate, variant = "create" }) {
  const isRegenerate = variant === "regenerate";

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h4 className="m-0 text-sm font-bold text-slate-800">
        {isRegenerate ? "Tạo lại lộ trình" : "Tạo lộ trình học theo tài liệu"}
      </h4>
      <p className="m-0 mt-1.5 text-xs text-slate-500 leading-relaxed">
        {isRegenerate
          ? "Đổi mục tiêu và tạo lại lộ trình mới nếu bạn muốn điều chỉnh kế hoạch học."
          : "Nhập mục tiêu (tùy chọn). AI sẽ chia thành các giai đoạn và nhiệm vụ cụ thể dựa trên nội dung tài liệu."}
      </p>

      <div className="mt-3">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Mục tiêu học</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Ví dụ: Ôn chương 1-3 để thi giữa kỳ, hoặc nắm SRS phần chức năng"
        />
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="mt-3 cursor-pointer w-full rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {isGenerating ? "Đang tạo lộ trình..." : isRegenerate ? "Tạo lại lộ trình học" : "Tạo lộ trình học"}
      </button>
    </div>
  );
}

export default function WorkspaceRoadmapPanel({ selectedDocument, onClose, onGoToPage }) {
  const docId = selectedDocument?.id;

  const [roadmap, setRoadmap] = useState(null);
  const [goal, setGoal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const milestones = useMemo(() => (roadmap?.milestones || []).filter(Boolean), [roadmap]);
  const hasMilestones = milestones.length > 0;
  const progress = useMemo(() => buildRoadmapProgress(milestones), [milestones]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!docId) return;
      setIsLoading(true);
      setError("");
      try {
        const data = await getRoadmap(docId);
        if (!isMounted) return;
        const nextRoadmap = data?.roadmap || null;
        setRoadmap(nextRoadmap);
        if (nextRoadmap?.goal) setGoal(nextRoadmap.goal);
      } catch (err) {
        if (!isMounted) return;
        setError(getRoadmapError(err, "Không thể tải lộ trình học."));
        setRoadmap(null);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [docId]);

  async function handleGenerate() {
    if (!docId) return;
    setIsGenerating(true);
    setError("");

    try {
      const data = await generateRoadmap(docId, { goal });
      setRoadmap(data?.roadmap || null);
    } catch (err) {
      setError(getRoadmapError(err, "Không thể tạo lộ trình học."));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleToggleTask(task) {
    if (!docId || !task?.id) return;

    const currentStatus = String(task?.status || "todo").toLowerCase();
    const nextStatus = currentStatus === "done" ? "todo" : "done";

    setRoadmap((prev) => {
      const next = { ...(prev || {}) };
      next.milestones = (next.milestones || []).map((m) => {
        const tasks = (m.tasks || []).map((t) => (String(t.id) === String(task.id) ? { ...t, status: nextStatus } : t));
        return { ...m, tasks };
      });
      return next;
    });

    try {
      const data = await updateRoadmapTask(docId, task.id, nextStatus);
      setRoadmap(data?.roadmap || null);
    } catch (err) {
      setError(getRoadmapError(err, "Không thể cập nhật trạng thái nhiệm vụ."));
    }
  }

  if (!selectedDocument) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 p-4">
        <div className="text-xs font-bold text-slate-600">Chọn một tài liệu để xem lộ trình học.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 p-4">
      <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        >
          ← Quay lại Studio
        </button>

        <div className="text-right min-w-0">
          <p className="m-0 text-xs font-bold text-slate-700 truncate">{roadmap?.title || selectedDocument.title || "Tài liệu"}</p>
          {hasMilestones ? (
            <p className="m-0 mt-1 text-[10px] text-slate-500">
              {progress.pct === 100 ? "Đã hoàn thành lộ trình" : `Đang ở nhiệm vụ ${progress.done + 1}/${progress.total}`}
            </p>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading && !roadmap ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-xs text-slate-500">Đang tải lộ trình học...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {!hasMilestones ? (
            <GenerateRoadmapForm
              goal={goal}
              setGoal={setGoal}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
            />
          ) : null}

          {hasMilestones ? (
            <>
              <ProgressBar pct={progress.pct} done={progress.done} total={progress.total} />

              {roadmap?.summary ? (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h4 className="m-0 text-sm font-bold text-slate-800">Tổng quan lộ trình</h4>
                  <p className="m-0 mt-1.5 text-xs text-slate-600 leading-relaxed">{roadmap.summary}</p>
                  {roadmap.estimatedHours > 0 ? (
                    <p className="m-0 mt-2 text-[10px] font-semibold text-indigo-600">
                      Ước lượng: ~{roadmap.estimatedHours} giờ
                    </p>
                  ) : null}
                </div>
              ) : null}

              {milestones.map((m, index) => {
                const meta = progress.milestoneMeta[index] || { status: "upcoming", completed: 0, total: 0 };
                const statusInfo = MILESTONE_STATUS[meta.status] || MILESTONE_STATUS.upcoming;

                return (
                  <div
                    key={m.id || index}
                    className={`rounded-2xl border p-4 shadow-sm transition-colors ${
                      meta.status === "active"
                        ? "border-indigo-200 bg-indigo-50/30"
                        : meta.status === "done"
                          ? "border-emerald-100 bg-white"
                          : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                          Giai đoạn {index + 1}
                        </p>
                        <p className="m-0 mt-0.5 text-sm font-bold text-slate-800">{m.title || "Milestone"}</p>
                        {meta.total > 0 ? (
                          <p className="m-0 mt-1 text-[10px] text-slate-500">
                            {meta.completed}/{meta.total} nhiệm vụ
                          </p>
                        ) : null}
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(m.tasks || []).map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onToggle={handleToggleTask}
                          isCurrent={String(t.id) === String(progress.currentTaskId)}
                          onGoToPage={onGoToPage}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              <GenerateRoadmapForm
                goal={goal}
                setGoal={setGoal}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                variant="regenerate"
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
