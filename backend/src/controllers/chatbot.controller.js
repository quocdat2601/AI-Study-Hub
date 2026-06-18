const chatbotService = require('../services/chatbot.service');

function sendMessage(req, res, next) {
  try {
    const result = chatbotService.sendMessage(req.body?.message);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendMessage,
};
