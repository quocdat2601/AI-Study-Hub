import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import {
  getOnboardingOptions,
  getSuggestedTags,
  getSubjectsByMajor,
  saveOnboarding,
  searchTags,
} from "../services/onboardingApi.js";

const GOALS = [
  { value: "exam", label: "Ôn thi", desc: "Tài liệu giúp ôn tập và luyện thi" },
  { value: "project", label: "Đồ án", desc: "Tài liệu phục vụ đồ án, dự án" },
  { value: "self_study", label: "Tự học", desc: "Mở rộng kiến thức theo nhịp riêng" },
];

const STEPS = ["Chọn ngành", "Môn & chủ đề", "Mục tiêu"];

function normalizeTopic(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [step, setStep] = useState(0);
  const [majors, setMajors] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [majorId, setMajorId] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopic, setCustomTopic] = useState("");
  const [tagMatches, setTagMatches] = useState([]);
  const [goal, setGoal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đã onboard rồi thì không cần ở lại trang này
  useEffect(() => {
    if (user?.onboarded) navigate("/dashboard", { replace: true });
  }, [user?.onboarded, navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const options = await getOnboardingOptions();
        if (!mounted) return;
        setMajors(options.majors || []);
        setSubjects(options.subjects || []);
        setSuggestedTags(options.suggestedTags || []);
      } catch {
        if (mounted) addToast({ type: "error", message: "Không tải được dữ liệu onboarding." });
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  async function handleSelectMajor(id) {
    setMajorId(id);
    // Đổi ngành → reset môn đã chọn cho khớp danh mục ngành mới
    setSelectedSubjects([]);
    try {
      const [subs, tags] = await Promise.all([getSubjectsByMajor(id), getSuggestedTags(id)]);
      setSubjects(subs);
      setSuggestedTags(tags);
    } catch {
      setSubjects([]);
      setSuggestedTags([]);
    }
  }

  function toggleSubject(id) {
    setSelectedSubjects((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    );
  }

  // Danh sách chip gợi ý: tag theo ngành trước, rồi tag phổ biến, đã khử trùng tên
  const topicOptions = useMemo(() => {
    const seen = new Set();
    const merged = [];
    // Chip chỉ hiện tag gợi ý theo ĐÚNG ngành đã chọn (tag ngành khác lấy qua ô "Thêm chủ đề")
    suggestedTags.forEach((tag) => {
      const name = normalizeTopic(tag.name);
      if (name && !seen.has(name)) {
        seen.add(name);
        merged.push(name);
      }
    });
    // Topic tự thêm nhưng không nằm trong gợi ý vẫn hiển thị để bỏ chọn được
    selectedTopics.forEach((name) => {
      if (!seen.has(name)) {
        seen.add(name);
        merged.push(name);
      }
    });
    return merged;
  }, [suggestedTags, selectedTopics]);

  function toggleTopic(name) {
    const normalized = normalizeTopic(name);
    setSelectedTopics((current) =>
      current.includes(normalized)
        ? current.filter((t) => t !== normalized)
        : [...current, normalized]
    );
  }

  // Gõ tới đâu gợi ý tag đã có tới đó (debounce) — khuyến khích tái dùng tag thay vì tạo mới
  useEffect(() => {
    const q = normalizeTopic(customTopic);
    if (!q) {
      setTagMatches([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchTags(q, 8);
        setTagMatches(results.filter((tag) => !selectedTopics.includes(tag.name)));
      } catch {
        setTagMatches([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customTopic, selectedTopics]);

  function addTopic(name) {
    const normalized = normalizeTopic(name);
    if (normalized && !selectedTopics.includes(normalized)) {
      setSelectedTopics((current) => [...current, normalized]);
    }
    setCustomTopic("");
    setTagMatches([]);
  }

  // Bước 2 chỉ bắt buộc chọn ≥1 môn học; chủ đề (tag) là tùy chọn
  const canNext = step === 0 ? Boolean(majorId) : step === 1 ? selectedSubjects.length > 0 : Boolean(goal);

  async function handleFinish() {
    if (!goal || !selectedSubjects.length) return;
    setIsSubmitting(true);
    try {
      await saveOnboarding({ majorId, goal, subjects: selectedSubjects, topics: selectedTopics });
      await refreshUser();
      addToast({ type: "success", message: "Đã lưu sở thích của bạn!" });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      addToast({ type: "error", message: err.response?.data?.error || "Không lưu được. Thử lại nhé." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    index <= step
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    index <= step ? "text-slate-900 dark:text-slate-100" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
            </React.Fragment>
          ))}
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Đang tải...</p>
        ) : (
          <>
            {/* Step 1: Major */}
            {step === 0 && (
              <section>
                <h1 className="m-0 text-xl font-bold text-slate-900 dark:text-slate-100">Bạn học ngành gì?</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Chúng tôi sẽ gợi ý chủ đề phù hợp với ngành của bạn.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {majors.map((major) => (
                    <button
                      key={major.id}
                      type="button"
                      onClick={() => handleSelectMajor(major.id)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        majorId === major.id
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {major.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Step 2: Subjects (bắt buộc) + Topics (tùy chọn) */}
            {step === 1 && (
              <section>
                <h1 className="m-0 text-xl font-bold text-slate-900 dark:text-slate-100">Bạn học những môn nào?</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Chọn môn học bạn quan tâm — đây là cơ sở chính để gợi ý tài liệu. (đã chọn {selectedSubjects.length})
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {subjects.length ? (
                    subjects.map((subject) => {
                      const active = selectedSubjects.includes(subject.id);
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => toggleSubject(subject.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-indigo-500 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {subject.name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400">Ngành này chưa có môn học nào.</p>
                  )}
                </div>

                <h2 className="mt-7 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Chủ đề quan tâm <span className="font-normal text-slate-400">(tùy chọn · đã chọn {selectedTopics.length})</span>
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topicOptions.map((name) => {
                    const active = selectedTopics.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleTopic(name)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-indigo-500 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          // Enter ưu tiên chọn gợi ý đầu tiên nếu có, nếu không thì thêm chữ tự gõ
                          addTopic(tagMatches[0]?.name || customTopic);
                        }
                      }}
                      placeholder="Thêm chủ đề khác..."
                      className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    {tagMatches.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        {tagMatches.map((tag) => (
                          <li key={tag.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => addTopic(tag.name)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <span>{tag.name}</span>
                              <span className="text-xs text-slate-400">{tag.doc_count} tài liệu</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addTopic(customTopic)}
                    className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Thêm
                  </button>
                </div>
              </section>
            )}

            {/* Step 3: Goal */}
            {step === 2 && (
              <section>
                <h1 className="m-0 text-xl font-bold text-slate-900 dark:text-slate-100">Mục tiêu của bạn?</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Giúp cá nhân hóa trải nghiệm học tập.</p>
                <div className="mt-5 grid gap-3">
                  {GOALS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGoal(option.value)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        goal === option.value
                          ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{option.label}</strong>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="min-h-10 rounded-lg px-4 text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:invisible dark:text-slate-400"
              >
                Quay lại
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext}
                  className="min-h-10 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiếp tục
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={!canNext || isSubmitting}
                  className="min-h-10 rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Đang lưu..." : "Hoàn tất"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
