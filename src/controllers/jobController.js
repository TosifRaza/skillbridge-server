const JobService = require('../services/jobService');
const ApiResponse = require('../utils/ApiResponse');

class JobController {
  async createJob(req, res, next) {
    try {
      const job = await JobService.createJob(req.user.id, req.body, req.files);
      res.status(201).json(new ApiResponse(201, job, 'Job created successfully'));
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req, res, next) {
    try {
      const job = await JobService.updateJob(req.params.id, req.user.id, req.body);
      res.status(200).json(new ApiResponse(200, job, 'Job updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req, res, next) {
    try {
      await JobService.deleteJob(req.params.id, req.user.id);
      res.status(200).json(new ApiResponse(200, null, 'Job deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async closeJob(req, res, next) {
    try {
      const job = await JobService.closeJob(req.params.id, req.user.id);
      res.status(200).json(new ApiResponse(200, job, 'Job closed successfully'));
    } catch (error) {
      next(error)
    }
  }

  async getMyJobs(req, res, next) {
    try {
      const result = await JobService.getMyJobs(req.user.id, req.query);
      res.status(200).json(new ApiResponse(200, result, 'Your jobs fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getAvailableJobs(req, res, next) {
    try {
      const result = await JobService.getAvailableJobs(req.query);
      res.status(200).json(new ApiResponse(200, result, 'Available jobs fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req, res, next) {
    try {
      const job = await JobService.getJobById(req.params.id);
      res.status(200).json(new ApiResponse(200, job, 'Job fetched successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new JobController();