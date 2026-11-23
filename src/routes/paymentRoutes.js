const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/job/:jobId', protect, paymentController.getStatus);
router.post('/job/:jobId/order', protect, authorize('customer'), paymentController.createOrder);
router.post('/verify', protect, authorize('customer'), paymentController.verify);
router.post('/job/:jobId/submit-work', protect, authorize('provider'), paymentController.submitWork);
router.post('/job/:jobId/release', protect, authorize('customer'), paymentController.release);

module.exports = router;
