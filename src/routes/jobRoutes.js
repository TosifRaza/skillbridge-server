const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadJobImages } = require('../middlewares/uploadMiddleware');
const { createJobValidator, updateJobValidator, validate } = require('../validators/jobValidator');

/**
 * @swagger
 * /api/v1/jobs:
 *   post:
 *     summary: Create a new job (Customer only)
 */
router.post(
  '/',
  protect,
  authorize('customer'),
  uploadJobImages, // Multer middleware to handle files
  createJobValidator,
  validate,
  jobController.createJob
);

/**
 * @swagger
 * /api/v1/jobs/my-jobs:
 *   get:
 *     summary: Get all jobs posted by the logged-in customer
 */
router.get(
  '/my-jobs',
  protect,
  authorize('customer'),
  jobController.getMyJobs
);

/**
 * @swagger
 * /api/v1/jobs/available:
 *   get:
 *     summary: Browse and search available jobs (Worker only)
 */
router.get(
  '/available',
  protect,
  authorize('provider'),
  jobController.getAvailableJobs
);

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   get:
 *     summary: Get a single job by ID
 */
router.get(
  '/:id',
  protect,
  jobController.getJobById
);

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   put:
 *     summary: Update a job (Customer only, status must be Open)
 */
router.put(
  '/:id',
  protect,
  authorize('customer'),
  updateJobValidator,
  validate,
  jobController.updateJob
);

/**
 * @swagger
 * /api/v1/jobs/{id}/close:
 *   patch:
 *     summary: Close a job (Customer only)
 */
router.patch(
  '/:id/close',
  protect,
  authorize('customer'),
  jobController.closeJob
);

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   delete:
 *     summary: Delete a job (Customer only, status must be Open)
 */
router.delete(
  '/:id',
  protect,
  authorize('customer'),
  jobController.deleteJob
);

module.exports = router;