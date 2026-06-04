const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatar } = require('../middlewares/uploadMiddleware'); // NEW IMPORT

router.patch('/me', protect, userController.updateProfile);
router.patch('/me/avatar', protect, uploadAvatar, userController.updateAvatar); // Uses single upload

module.exports = router;