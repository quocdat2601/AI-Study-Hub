import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getChatbotReply } from "../../lib/chatbotReplies.js";
import { sendChatbotMessage } from "../../services/chatbotApi.js";

const WELCOME_MESSAGE = {
  id: "welcome",
  from: "chatbot",
  text: "Xin chào! Mình là chatbot — hỗ trợ bạn dùng trang web.",
};

function createMessage(from, text) {
  return {
    id: `${from}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from,
    text,
  };
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ChatbotTyping() {
  return (
    <div className="chatbot-message-bot flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3">
        <span className="chatbot-typing-dot h-2 w-2 rounded-full bg-slate-400" />
        <span className="chatbot-typing-dot h-2 w-2 rounded-full bg-slate-400" />
        <span className="chatbot-typing-dot h-2 w-2 rounded-full bg-slate-400" />
      </div>
    </div>
  );
}

export default function LandingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isOpen]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage = createMessage("user", text);
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const data = await sendChatbotMessage(text);
      setMessages((current) => [
        ...current,
        createMessage("chatbot", data.reply),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        createMessage("chatbot", getChatbotReply(text)),
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <div
          className="chatbot-panel flex w-[min(100vw-2.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white"
          role="dialog"
          aria-label="chatbot"
        >
          <header className="chatbot-panel-header flex items-center gap-3 bg-indigo-600 px-4 py-3 text-white">
            <img
              alt=""
              className="chatbot-header-mascot h-10 w-10 rounded-full bg-white/20 object-cover"
              src="/landing/chatbot-mascot.png"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-bold">chatbot</p>
            </div>
            <button
              aria-label="Đóng chatbot"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-white/15 text-white transition hover:bg-white/25"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
          </header>

          <div
            className="chatbot-panel-body flex max-h-[320px] min-h-[240px] flex-col gap-3 overflow-y-auto bg-slate-50 px-3 py-4"
            ref={listRef}
          >
            {messages.map((message) => {
              const isUser = message.from === "user";
              return (
                <div
                  className={`flex ${isUser ? "chatbot-message-user justify-end" : "chatbot-message-bot justify-start"}`}
                  key={message.id}
                >
                  <p
                    className={`m-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "rounded-br-md bg-indigo-600 text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              );
            })}
            {isSending ? <ChatbotTyping /> : null}
          </div>

          <form className="chatbot-panel-footer border-t border-slate-200 bg-white p-3" onSubmit={sendMessage}>
            <div className="flex items-center gap-2">
              <input
                className="min-h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                disabled={isSending}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Nhắn cho chatbot..."
                value={input}
              />
              <button
                aria-label="Gửi tin nhắn"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-50"
                disabled={!input.trim() || isSending}
                type="submit"
              >
                <SendIcon />
              </button>
            </div>
            <p className="m-0 mt-2 text-center text-[11px] text-slate-400">
              Cần hỏi AI về tài liệu? Vào{" "}
              <Link className="font-semibold text-indigo-600 no-underline hover:underline" to="/login">
                Workspace
              </Link>
              {" "}sau khi đăng nhập.
            </p>
          </form>
        </div>
      ) : null}

      <div className="chatbot-launcher">
        {!isOpen ? <span aria-hidden="true" className="chatbot-pulse-ring" /> : null}
        <button
          aria-expanded={isOpen}
          aria-label={isOpen ? "Thu gọn chatbot" : "Mở chatbot"}
          className={`chatbot-float-btn flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-full border-0 bg-white p-0 shadow-[0_12px_32px_rgba(79,70,229,0.35)] ring-4 ring-indigo-100 transition hover:scale-105 active:scale-95 ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          <img
            alt="Mở chatbot"
            className="chatbot-mascot-img h-full w-full object-cover"
            src="/landing/chatbot-mascot.png"
          />
        </button>
      </div>
    </div>
  );
}
