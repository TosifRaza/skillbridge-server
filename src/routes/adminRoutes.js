const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// All routes below this line require Admin authentication
router.use(protect, authorize('admin'));

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get Admin Dashboard Analytics
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users (with filters)
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/v1/admin/users/{id}/block:
 *   patch:
 *     summary: Block a user
 */
router.patch('/users/:id/block', adminController.blockUser);

/**
 * @swagger
 * /api/v1/admin/users/{id}/unblock:
 *   patch:
 *     summary: Unblock a user
 */
router.patch('/users/:id/unblock', adminController.unblockUser);

/**
 * @swagger
 * /api/v1/admin/workers/{id}/verify:
 *   patch:
 *     summary: Verify a worker
 */
router.patch('/workers/:id/verify', adminController.verifyWorker);

/**
 * @swagger
 * /api/v1/admin/workers/{id}/reject:
 *   patch:
 *     summary: Reject worker verification
 */
router.patch('/workers/:id/reject', adminController.rejectWorkerVerification);

/**
 * @swagger
 * /api/v1/admin/jobs:
 *   get:
 *     summary: Monitor all jobs
 */
router.get('/jobs', adminController.getAllJobs);

/**
 * @swagger
 * /api/v1/admin/jobs/{id}:
 *   delete:
 *     summary: Remove a problematic job
 */
router.delete('/jobs/:id', adminController.removeJob);

/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: View all reports & disputes
 */
router.get('/reports', adminController.getReports);

/**
 * @swagger
 * /api/v1/admin/reports/{id}/resolve:
 *   patch:
 *     summary: Resolve a report
 */
router.patch('/reports/:id/resolve', adminController.resolveReport);

module.exports = router;