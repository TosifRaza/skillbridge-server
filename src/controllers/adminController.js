const AdminService = require('../services/adminService');
const ApiResponse = require('../utils/ApiResponse');

class AdminController {
  async getDashboardStats(req, res, next) {
    try {
      const stats = await AdminService.getDashboardStats();
      res.status(200).json(new ApiResponse(200, stats, 'Dashboard stats fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await AdminService.getAllUsers(req.query);
      res.status(200).json(new ApiResponse(200, users, 'Users fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async blockUser(req, res, next) {
    try {
      const user = await AdminService.toggleBlockUser(req.params.id, true);
      res.status(200).json(new ApiResponse(200, user, 'User blocked successfully'));
    } catch (error) {
      next(error);
    }
  }

  async unblockUser(req, res, next) {
    try {
      const user = await AdminService.toggleBlockUser(req.params.id, false);
      res.status(200).json(new ApiResponse(200, user, 'User unblocked successfully'));
    } catch (error) {
      next(error);
    }
  }

  async verifyWorker(req, res, next) {
    try {
      const worker = await AdminService.verifyWorker(req.params.id);
      res.status(200).json(new ApiResponse(200, worker, 'Worker verified successfully'));
    } catch (error) {
      next(error);
    }
  }

  async rejectWorkerVerification(req, res, next) {
    try {
      const worker = await AdminService.rejectWorkerVerification(req.params.id);
      res.status(200).json(new ApiResponse(200, worker, 'Worker verification rejected'));
    } catch (error) {
      next(error);
    }
  }

  async getAllJobs(req, res, next) {
    try {
      const jobs = await AdminService.getAllJobs(req.query);
      res.status(200).json(new ApiResponse(200, jobs, 'Jobs fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async removeJob(req, res, next) {
    try {
      await AdminService.removeJob(req.params.id);
      res.status(200).json(new ApiResponse(200, null, 'Job removed successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getReports(req, res, next) {
    try {
      const reports = await AdminService.getReports(req.query);
      res.status(200).json(new ApiResponse(200, reports, 'Reports fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async resolveReport(req, res, next) {
    try {
      const { resolution } = req.body;
      const report = await AdminService.resolveReport(req.params.id, req.user.id, resolution);
      res.status(200).json(new ApiResponse(200, report, 'Report resolved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();