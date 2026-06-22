const express = require('express');
const chatbotController = require('../controllers/chatbot.controller');

const router = express.Router();

// POST /api/chatbot/message  { "message": "..." }  ->  { "reply": "..." }
router.post('/message', chatbotController.sendMessage);

module.exports = router;
