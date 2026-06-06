// const express = require('express');
// const router = express.Router();
// const chatController = require('../controllers/chatController');
// const { protect } = require('../middlewares/authMiddleware');
// const { uploadJobImages } = require('../middlewares/uploadMiddleware'); // Reusing single file upload

// router.get('/:conversationId', protect, chatController.getChatHistory);
// router.get('/conversations', protect, chatController.getConversations);
// router.post(
//   '/upload-image',
//   protect,
//   uploadJobImages,
//   chatController.uploadChatImage
// );

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const chatController = require('../controllers/chatController');
// const { protect } = require('../middlewares/authMiddleware');
// const { uploadChatImage } = require('../middlewares/uploadMiddleware'); // UPDATED IMPORT

// router.get('/:conversationId', protect, chatController.getChatHistory);

// router.post(
//   '/upload-image',
//   protect,
//   uploadChatImage, // UPDATED MIDDLEWARE
//   chatController.uploadChatImage
// );

// module.exports = router;




// const express = require('express');
// const router = express.Router();
// const chatController = require('../controllers/chatController');
// const { protect } = require('../middlewares/authMiddleware');
// const { uploadChatImage } = require('../middlewares/uploadMiddleware'); // UPDATED IMPORT

// router.get('/:conversationId', protect, chatController.getChatHistory);

// router.post(
//   '/upload-image',
//   protect,
//   uploadChatImage, // UPDATED MIDDLEWARE
//   chatController.uploadChatImage
// );

// module.exports = router;


const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadChatImage } = require('../middlewares/uploadMiddleware');

// FIX: Added /conversations route BEFORE /:conversationId
router.get('/conversations', protect, chatController.getConversations);

router.get('/:conversationId', protect, chatController.getChatHistory);

router.post(
  '/upload-image',
  protect,
  uploadChatImage,
  chatController.uploadChatImage
);

module.exports = router;