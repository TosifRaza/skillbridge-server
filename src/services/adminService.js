const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Report = require('../models/Report');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const razorpayRoute = require('../integrations/razorpayRoute');

class AdminService {
  /**
   * Get Dashboard Analytics
   */
  async getDashboardStats() {
    const now = new Date();
    const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        month: date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
      };
    });

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

    const [revenueData, categoryData, userGrowthData, revenueTrendData] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'Released' } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' } } },
      ]),
      Job.aggregate([
        { $group: { _id: '$category', jobs: { $sum: 1 } } },
        { $sort: { jobs: -1, _id: 1 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: firstMonth } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, users: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'Released', releasedAt: { $gte: firstMonth } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$releasedAt' } }, revenue: { $sum: '$commissionAmount' } } },
      ]),
    ]);

    const totalRevenue = revenueData[0]?.total || 0;
    const usersByMonth = new Map(userGrowthData.map(({ _id, users }) => [_id, users]));
    const revenueByMonth = new Map(revenueTrendData.map(({ _id, revenue }) => [_id, revenue]));

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
      categoryBreakdown: categoryData.map(({ _id, jobs }) => ({ name: _id || 'Uncategorized', jobs })),
      userGrowth: months.map(({ key, month }) => ({ month, users: usersByMonth.get(key) || 0 })),
      revenueTrend: months.map(({ key, month }) => ({ month, revenue: revenueByMonth.get(key) || 0 })),
    };
  }

  /**
   * Get all users with filtering and pagination
   */
  async getAllUsers(query) {
    const { role, isBlocked, search, verificationStatus, page = 1, limit = 10 } = query;
    const filter = {};

    if (role) filter.role = role;
    if (verificationStatus) filter.verificationStatus = verificationStatus;
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

  async connectWorkerPayoutAccount(workerId, linkedAccountId) {
    if (!/^acc_[A-Za-z0-9]+$/.test(linkedAccountId || '')) {
      throw new ApiError(400, 'A valid Razorpay Route linked account ID is required');
    }
    const worker = await User.findOne({ _id: workerId, role: 'provider' }).select('+razorpayLinkedAccountId');
    if (!worker) throw new ApiError(404, 'Worker not found');
    const linkedAccount = await razorpayRoute.fetchLinkedAccount(linkedAccountId);
    if (linkedAccount.id !== linkedAccountId) throw new ApiError(409, 'Razorpay could not verify this linked account');
    worker.razorpayLinkedAccountId = linkedAccountId;
    worker.payoutStatus = 'Active';
    await worker.save();
    return { _id: worker._id, email: worker.email, payoutStatus: worker.payoutStatus };
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
