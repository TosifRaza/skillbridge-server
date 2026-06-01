const ReviewService = require('../services/reviewService');
const ApiResponse = require('../utils/ApiResponse');

class ReviewController {
  /**
   * @route POST /api/v1/reviews
   * @desc Customer creates a review for a worker
   */
  async createReview(req, res, next) {
    try {
      const review = await ReviewService.createReview(req.user.id, req.body);
      res.status(201).json(new ApiResponse(201, review, 'Review submitted successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /api/v1/reviews/worker/:workerId
   * @desc Get all reviews for a worker
   */
  async getWorkerReviews(req, res, next) {
    try {
      const result = await ReviewService.getWorkerReviews(req.params.workerId, req.query);
      res.status(200).json(new ApiResponse(200, result, 'Worker reviews fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /api/v1/reviews/distribution/:workerId
   * @desc Get rating distribution (1-5 stars) for a worker
   */
  async getRatingDistribution(req, res, next) {
    try {
      const distribution = await ReviewService.getRatingDistribution(req.params.workerId);
      res.status(200).json(new ApiResponse(200, distribution, 'Rating distribution fetched successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();