const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

class ReviewService {
  /**
   * Create a review for a worker after job completion
   */
  async createReview(reviewerId, reviewData) {
    const { job: jobId, worker: workerId, rating, comment } = reviewData;

    // 1. Verify the job exists and is completed
    const job = await Job.findById(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    if (job.status !== 'Completed') throw new ApiError(400, 'You can only review completed jobs');

    // 2. Verify the reviewer is the customer who posted the job
    if (job.customer.toString() !== reviewerId.toString()) {
      throw new ApiError(403, 'You are not authorized to review this job');
    }

    // 3. Verify the worker being reviewed is the one who was hired
    if (!job.hiredProvider || job.hiredProvider.toString() !== workerId.toString()) {
      throw new ApiError(400, 'This worker was not hired for the specified job');
    }

    // 4. Attempt to create the review (catches duplicate index errors natively)
    try {
      const review = await Review.create({
        job: jobId,
        reviewer: reviewerId,
        reviewee: workerId,
        rating,
        comment,
      });

      // 5. Update the worker's average rating
      await this.calculateAverageRating(workerId);

      return review;
    } catch (error) {
      if (error.code === 11000) {
        throw new ApiError(409, 'You have already submitted a review for this job');
      }
      throw error;
    }
  }

  /**
   * Calculate and update the average rating on the User document
   */
  async calculateAverageRating(workerId) {
    const stats = await Review.aggregate([
      { $match: { reviewee: workerId } },
      {
        $group: {
          _id: '$reviewee',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await User.findByIdAndUpdate(workerId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
        totalReviews: stats[0].totalReviews,
      });
    } else {
      await User.findByIdAndUpdate(workerId, { averageRating: 0, totalReviews: 0 });
    }
  }

  /**
   * Get all reviews for a specific worker (with pagination)
   */
  async getWorkerReviews(workerId, query) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ reviewee: workerId })
      .populate('reviewer', 'email role') // Show who left the review
      .populate('job', 'title category')  // Show context of the job
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ reviewee: workerId });

    return { reviews, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Get the rating distribution (1-5 stars) for a worker
   */
  async getRatingDistribution(workerId) {
    const distribution = await Review.aggregate([
      { $match: { reviewee: workerId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } }, // Sort by rating descending (5 to 1)
    ]);

    // Format into a clean object: { 5: 12, 4: 5, 3: 1, 2: 0, 1: 0 }
    const result = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(item => {
      result[item._id] = item.count;
    });

    return result;
  }
}

module.exports = new ReviewService();