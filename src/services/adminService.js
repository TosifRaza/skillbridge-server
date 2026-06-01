const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Report = require('../models/Report');
const ApiError = require('../utils/ApiError');

class AdminService {
  /**
   * Get Dashboard Analytics
   */
  async getDashboardStats() {
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalWorkers = await User.countDocuments({ role: 'provider' });
    const totalJobs = await Job.countDocuments();

    // Aggregation to get jobs by status
    const jobStats = await Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate theoretical revenue (sum of budget of completed jobs)
    const revenueData = await Job.aggregate([
      { $match: { status: 'Completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$budget' },
        },
      },
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

    // Format job stats into an object
    const formattedJobStats = {};
    jobStats.forEach(stat => {
      formattedJobStats[stat._id] = stat.count;
    });

    return {
      totalUsers,
      totalWorkers,
      totalJobs,
      totalRevenue,
      jobStatusBreakdown: formattedJobStats,
    };
  }

  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(query) {
    const { role, isBlocked, search, page = 1, limit = 10 } = query;
    const filter = {};

    if (role) filter.role = role;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (search) {
      filter.email = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    return { users, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  /**
   * Block/Unblock a user
   */
  async toggleBlockUser(userId, isBlocked) {
    const user = await User.findByIdAndUpdate(userId, { isBlocked }, { new: true });
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  }

  /**
   * Verify a worker (Set verificationStatus to 'Verified')
   */
  async verifyWorker(workerId) {
    const worker = await User.findOne({ _id: workerId, role: 'provider' });
    if (!worker) throw new ApiError(404, 'Worker not found');
    
    worker.verificationStatus = 'Verified';
    await worker.save();
    return worker;
  }

  /**
   * Reject a worker's verification
   */
  async rejectWorkerVerification(workerId) {
    const worker = await User.findOne({ _id: workerId, role: 'provider' });
    if (!worker) throw new ApiError(404, 'Worker not found');

    worker.verificationStatus = 'Rejected';
    await worker.save();
    return worker;
  }

  /**
   * Get all jobs with filters for monitoring
   */
  async getAllJobs(query) {
    const { status, category, page = 1, limit = 10 } = query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;

    const jobs = await Job.find(filter)
      .populate('customer', 'email')
      .populate('hiredProvider', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Job.countDocuments(filter);

    return { jobs, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  /**
   * Admin removes a problematic job
   */
  async removeJob(jobId) {
    const job = await Job.findByIdAndDelete(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    
    // Also delete associated applications to maintain DB integrity
    await Application.deleteMany({ job: jobId });
    return true;
  }

  /**
   * Get all reports/disputes
   */
  async getReports(query) {
    const { status, page = 1, limit = 10 } = query;
    const filter = {};

    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const reports = await Report.find(filter)
      .populate('reporter', 'email')
      .populate('reportedUser', 'email')
      .populate('job', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Report.countDocuments(filter);

    return { reports, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  /**
   * Resolve a report/dispute
   */
  async resolveReport(reportId, adminId, resolution) {
    const report = await Report.findById(reportId);
    if (!report) throw new ApiError(404, 'Report not found');

    report.status = 'Resolved';
    report.resolution = resolution;
    report.resolvedBy = adminId;
    await report.save();

    return report;
  }
}

module.exports = new AdminService();