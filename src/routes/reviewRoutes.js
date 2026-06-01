const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createReviewValidator, validate } = require('../validators/reviewValidator');

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Customer leaves a review for a worker
 */
router.post(
  '/',
  protect,
  authorize('customer'),
  createReviewValidator,
  validate,
  reviewController.createReview
);

/**
 * @swagger
 * /api/v1/reviews/worker/{workerId}:
 *   get:
 *     summary: Get all reviews for a specific worker
 */
router.get(
  '/worker/:workerId',
  protect,
  reviewController.getWorkerReviews
);

/**
 * @swagger
 * /api/v1/reviews/distribution/{workerId}:
 *   get:
 *     summary: Get rating distribution (1-5 stars) for a worker
 */
router.get(
  '/distribution/:workerId',
  protect,
  reviewController.getRatingDistribution
);

module.exports = router;