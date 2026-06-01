const express = require('express');

const router = express.Router();
const authRoutes = require('../routes/authRoutes'); // <-- ADD THIS
const jobRoutes = require('./jobRoutes'); // <-- ADD
const applicationRoutes = require('./applicationRoutes'); // <-- ADD
const chatRoutes = require('./chatRoutes'); // <-- ADD
const reviewRoutes = require('./reviewRoutes'); // <-- ADD
const adminRoutes = require('./adminRoutes'); // <-- ADD


router.use('/auth', authRoutes); // <-- ADD THIS
router.use('/jobs', jobRoutes); // <-- ADD
router.use('/applications', applicationRoutes); // <-- ADD
router.use('/chat', chatRoutes); // <-- ADD
router.use('/reviews', reviewRoutes); // <-- ADD
router.use('/admin', adminRoutes); // <-- ADD

// Health check route for monitoring and uptime checks
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SkillBridge API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Future routes will be mounted here:
// router.use('/auth', authRoutes);
// router.use('/jobs', jobRoutes);
// router.use('/admin', adminRoutes);

module.exports = router;
