import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";

const AVATAR_SRC = "/landing/chatbot-avatar.jpg";

const WELCOME =
  "Xin chào! Tôi là trợ lý AI Study Hub. Bạn cần hỗ trợ tìm tài liệu, upload file hay dùng AI Workspace?";

const QUICK_QUESTIONS = [
  "AI Workspace là gì?",
  "Làm sao upload tài liệu?",
  "Tôi cần đăng nhập không?",
];

function makeId() {
  return `landing-chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildBotReply(question, isAuthenticated) {
  const text = question.toLowerCase();

  if (text.includes("workspace") || text.includes("ai workspace") || text.includes("hỏi ai")) {
    if (isAuthenticated) {
      return "Mở AI Workspace từ menu để xem PDF và chat theo nội dung tài liệu.";
    }
    return "AI Workspace giúp bạn xem PDF và hỏi AI theo nội dung file. Hãy đăng nhập trước, sau đó vào mục AI Workspace.";
  }

  if (text.includes("upload") || text.includes("tải lên") || text.includes("tài liệu")) {
    return "Vào My Documents → New Document để upload PDF hoặc DOCX. File sẽ được lưu vào thư viện của bạn.";
  }

  if (text.includes("đăng nhập") || text.includes("login") || text.includes("đăng ký")) {
    return "Bạn có thể Log in hoặc Sign up miễn phí ở góc phải trang. Sau khi đăng nhập sẽ dùng được đầy đủ tính năng.";
  }

  if (text.includes("pdf") || text.includes("scan")) {
    return "AI chat hoạt động tốt với PDF có text chọn được. PDF scan (ảnh) chỉ xem được, AI khó đọc nội dung.";
  }

  return isAuthenticated
    ? "Bạn có thể tìm tài liệu ở thanh Search, xem Trending, hoặc mở AI Workspace để chat với file PDF."
    : "Dùng thanh Search để tìm tài liệu, hoặc đăng nhập để upload file và dùng AI Workspace.";
}

function MascotAvatar({ size = 56, animated = false, className = "" }) {
  return (
    <span
      className={`landing-chat-avatar ${animated ? "landing-chat-float" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <img alt="AI chatbot" draggable={false} src={AVATAR_SRC} />
    </span>
  );
}

function TypingBubble() {
  return (
    <div className="landing-chat-msg-in flex items-start gap-2">
      <MascotAvatar size={34} animated />
      <div className="rounded-2xl rounded-tl-md border border-[#e8ebf0] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="landing-chat-dot h-2 w-2 rounded-full bg-[#4648d4]" />
          <span className="landing-chat-dot h-2 w-2 rounded-full bg-[#4648d4]" />
          <span className="landing-chat-dot h-2 w-2 rounded-full bg-[#4648d4]" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="landing-chat-msg-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[#5856eb] to-[#4648d4] px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_20px_rgba(70,72,212,0.22)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="landing-chat-msg-in flex items-start gap-2.5">
      <MascotAvatar size={34} />
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[#e8ebf0] bg-white/95 px-4 py-2.5 text-sm leading-relaxed text-[#191c1e] shadow-[0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        {message.content}
      </div>
    </div>
  );
}

/** Chatbot nổi góc phải dưới trang Landing. */
export default function LandingChatbot() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: makeId(), role: "assistant", content: WELCOME },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, isOpen]);

  function sendQuestion(text) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: trimmed },
    ]);
    setInput("");
    setIsTyping(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: buildBotReply(trimmed, isAuthenticated),
        },
      ]);
      setIsTyping(false);
    }, 900);
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendQuestion(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-3">
      {isOpen ? (
        <div
          className="landing-chat-panel-in relative flex w-[min(calc(100vw-2.5rem),392px)] flex-col overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/95 shadow-[0_24px_60px_rgba(70,72,212,0.28)] backdrop-blur-md"
          style={{ height: "min(540px, calc(100vh - 7rem))" }}
        >
          <header className="landing-chat-header relative px-4 pb-4 pt-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <MascotAvatar animated className="ring-2 ring-white/35" size={48} />
                <div>
                  <p className="flex items-center gap-1.5 text-[15px] font-bold leading-tight">
                    AI Study Hub
                    <Sparkles size={14} className="text-[#c7d2fe]" />
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/85">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#86efac] opacity-70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
                    </span>
                    Trợ lý trang chủ · Online
                  </p>
                </div>
              </div>
              <button
                aria-label="Đóng chat"
                className="flex h-9 w-9 items-center justify-center rounded-xl border-0 bg-white/12 text-white transition hover:bg-white/22"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8faff_0%,#f3f6fb_100%)] px-4 py-4"
            ref={scrollRef}
          >
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
              {isTyping ? <TypingBubble /> : null}
            </div>
          </div>

          <div className="border-t border-[#e8ebf0] bg-white px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  className="rounded-full border border-[#dfe3ec] bg-[#f7f9fc] px-3 py-1.5 text-[11px] font-medium text-[#464554] transition hover:-translate-y-0.5 hover:border-[#4648d4] hover:text-[#4648d4] hover:shadow-sm disabled:opacity-50"
                  disabled={isTyping}
                  key={question}
                  onClick={() => sendQuestion(question)}
                  type="button"
                >
                  {question}
                </button>
              ))}
            </div>

            <form className="flex items-end gap-2" onSubmit={handleSubmit}>
              <input
                className="min-h-[44px] flex-1 rounded-2xl border border-[#dfe3ec] bg-[#f8faff] px-4 py-2.5 text-sm outline-none transition focus:border-[#4648d4] focus:bg-white focus:ring-4 focus:ring-[#4648d4]/10 disabled:opacity-50"
                disabled={isTyping}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Nhập câu hỏi..."
                value={input}
              />
              <button
                aria-label="Gửi"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-0 bg-gradient-to-br from-[#5856eb] to-[#4648d4] text-white shadow-[0_8px_20px_rgba(70,72,212,0.28)] transition hover:scale-105 disabled:scale-100 disabled:opacity-50"
                disabled={isTyping || !input.trim()}
                type="submit"
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          <button
            aria-label="Thu gọn chat"
            className="absolute -right-3 top-1/2 flex h-10 w-6 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-[#e8ebf0] bg-white text-[#94a3b8] shadow-md transition hover:text-[#4648d4]"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <ChevronDown className="rotate-[-90deg]" size={14} />
          </button>
        </div>
      ) : null}

      {!isOpen ? (
        <button
          aria-label="Mở chat trợ lý"
          className="group relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full border-2 border-white/90 bg-white shadow-[0_14px_40px_rgba(70,72,212,0.32)] transition hover:scale-105"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <span className="landing-chat-ring absolute inset-0 rounded-full bg-[#4648d4]/20" />
          <span className="landing-chat-ring absolute inset-0 rounded-full bg-[#4648d4]/15 [animation-delay:0.8s]" />
          <MascotAvatar animated size={72} />
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            1
          </span>
        </button>
      ) : null}
    </div>
  );
}
