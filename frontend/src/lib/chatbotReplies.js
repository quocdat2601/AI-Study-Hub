// Fallback khi API chatbot lỗi (frontend offline).

const REPLY_RULES = [
  {
    keywords: ["đăng nhập", "login", "log in", "sign in"],
    reply:
      "Bạn có thể đăng nhập tại trang Login. Nếu chưa có tài khoản, chọn Sign up để tạo mới.",
  },
  {
    keywords: ["đăng ký", "sign up", "register", "tạo tài khoản"],
    reply:
      "Chọn Sign up ở góc trên hoặc vào trang Login rồi chuyển sang đăng ký. Sau khi xác nhận email, bạn có thể đăng nhập.",
  },
  {
    keywords: ["tài liệu", "document", "upload", "tải lên"],
    reply:
      "Sau khi đăng nhập, vào My documents để xem hoặc tải lên PDF. Tài liệu được sắp xếp theo môn học.",
  },
  {
    keywords: ["workspace", "học", "đọc pdf", "xem pdf"],
    reply:
      "Workspace dùng để đọc PDF và hỏi AI về nội dung tài liệu.",
  },
  {
    keywords: ["chat ai", "ask ai", "hỏi ai"],
    reply:
      "Chat AI nằm trong Workspace khi bạn mở một tài liệu.",
  },
  {
    keywords: ["xin chào", "hello", "hi", "chào"],
    reply:
      "Xin chào! Mình là chatbot. Bạn cần hỗ trợ đăng nhập, tài liệu hay workspace?",
  },
  {
    keywords: ["giúp", "help", "hướng dẫn"],
    reply:
      "Mình có thể gợi ý về: đăng nhập, đăng ký, tìm tài liệu, hoặc AI Workspace. Hãy gõ câu hỏi ngắn gọn.",
  },
];

const DEFAULT_REPLY =
  "Cảm ơn bạn đã nhắn. Mình là chatbot. Thử hỏi về đăng nhập, tài liệu hoặc workspace nhé.";

export function getChatbotReply(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return DEFAULT_REPLY;

  const rule = REPLY_RULES.find((item) =>
    item.keywords.some((keyword) => text.includes(keyword))
  );

  return rule?.reply || DEFAULT_REPLY;
}
