const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadJobImages } = require('../middlewares/uploadMiddleware'); // Reusing single file upload

router.get('/:conversationId', protect, chatController.getChatHistory);

router.post(
  '/upload-image',
  protect,
  uploadJobImages,
  chatController.uploadChatImage
);

module.exports = router;