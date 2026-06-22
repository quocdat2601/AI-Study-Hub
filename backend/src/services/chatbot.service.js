const createError = require('../utils/createError');

// Danh sách từ khóa -> câu trả lời của chatbot
const CHATBOT_RULES = [
  {
    keywords: ['đăng nhập', 'login', 'sign in'],
    reply: 'Bạn có thể đăng nhập tại trang Login. Nếu chưa có tài khoản, chọn Sign up.',
  },
  {
    keywords: ['đăng ký', 'sign up', 'register'],
    reply: 'Chọn Sign up ở góc trên hoặc vào Login rồi chuyển sang đăng ký.',
  },
  {
    keywords: ['tài liệu', 'document', 'upload'],
    reply: 'Sau khi đăng nhập, vào My documents để xem hoặc tải lên PDF.',
  },
  {
    keywords: ['workspace', 'đọc pdf', 'xem pdf'],
    reply: 'Workspace dùng để đọc PDF và hỏi Chat AI về nội dung tài liệu.',
  },
  {
    keywords: ['chat ai', 'ask ai', 'hỏi ai'],
    reply: 'Chat AI nằm trong Workspace khi bạn mở một tài liệu.',
  },
  {
    keywords: ['xin chào', 'hello', 'hi', 'chào'],
    reply: 'Xin chào! Mình là chatbot. Bạn cần hỗ trợ đăng nhập, tài liệu hay workspace?',
  },
  {
    keywords: ['giúp', 'help', 'hướng dẫn'],
    reply: 'Mình có thể gợi ý về đăng nhập, đăng ký, tài liệu hoặc Workspace.',
  },
];

const DEFAULT_REPLY =
  'Cảm ơn bạn đã nhắn. Mình là chatbot. Thử hỏi về đăng nhập, tài liệu hoặc workspace nhé.';

function sendMessage(message) {
  const text = String(message || '').trim();

  if (!text) {
    throw createError(400, 'message is required');
  }

  const lowerText = text.toLowerCase();

  for (const rule of CHATBOT_RULES) {
    const matched = rule.keywords.some((keyword) => lowerText.includes(keyword));
    if (matched) {
      return { reply: rule.reply };
    }
  }

  return { reply: DEFAULT_REPLY };
}

module.exports = {
  sendMessage,
};
