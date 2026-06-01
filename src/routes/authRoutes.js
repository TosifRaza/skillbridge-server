const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerValidator, loginValidator, validate } = require('../validators/authValidator');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 */
router.post('/register', registerValidator, validate, authController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login a user
 */
router.post('/login', loginValidator, validate, authController.login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 */
router.post('/refresh', authController.refreshAccessToken);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 */
router.post('/logout', protect, authController.logout);

module.exports = router;