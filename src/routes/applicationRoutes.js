const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createApplicationValidator, validate } = require('../validators/applicationValidator');

/**
 * @swagger
 * /api/v1/applications/apply:
 *   post:
 *     summary: Worker applies to a job
 */
router.post(
  '/apply',
  protect,
  authorize('provider'),
  createApplicationValidator,
  validate,
  applicationController.applyToJob
);

/**
 * @swagger
 * /api/v1/applications/applied:
 *   get:
 *     summary: Worker views jobs they applied to
 */
router.get(
  '/applied',
  protect,
  authorize('provider'),
  applicationController.getMyApplications
);

/**
 * @swagger
 * /api/v1/applications/{id}/withdraw:
 *   patch:
 *     summary: Worker withdraws their application
 */
router.patch(
  '/:id/withdraw',
  protect,
  authorize('provider'),
  applicationController.withdrawApplication
);

/**
 * @swagger
 * /api/v1/applications/job/{jobId}:
 *   get:
 *     summary: Customer views applications for a specific job they own
 */
router.get(
  '/job/:jobId',
  protect,
  authorize('customer'),
  applicationController.getJobApplications
);

/**
 * @swagger
 * /api/v1/applications/{id}/accept:
 *   patch:
 *     summary: Customer accepts an application (Assigns worker to job)
 */
router.patch(
  '/:id/accept',
  protect,
  authorize('customer'),
  applicationController.acceptApplication
);

/**
 * @swagger
 * /api/v1/applications/{id}/reject:
 *   patch:
 *     summary: Customer rejects an application
 */
router.patch(
  '/:id/reject',
  protect,
  authorize('customer'),
  applicationController.rejectApplication
);

module.exports = router;