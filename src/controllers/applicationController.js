const ApplicationService = require('../services/applicationService');
const ApiResponse = require('../utils/ApiResponse');

class ApplicationController {
  async applyToJob(req, res, next) {
    try {
      const application = await ApplicationService.applyToJob(req.user.id, req.body);
      res.status(201).json(new ApiResponse(201, application, 'Application submitted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async withdrawApplication(req, res, next) {
    try {
      const application = await ApplicationService.withdrawApplication(req.params.id, req.user.id);
      res.status(200).json(new ApiResponse(200, application, 'Application withdrawn successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getMyApplications(req, res, next) {
    try {
      const result = await ApplicationService.getMyApplications(req.user.id, req.query);
      res.status(200).json(new ApiResponse(200, result, 'Your applications fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getJobApplications(req, res, next) {
    try {
      const applications = await ApplicationService.getJobApplications(req.params.jobId, req.user.id);
      res.status(200).json(new ApiResponse(200, applications, 'Job applications fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  async acceptApplication(req, res, next) {
    try {
      const application = await ApplicationService.acceptApplication(req.params.id, req.user.id);
      res.status(200).json(new ApiResponse(200, application, 'Application accepted successfully'));
    } catch (error) {
      next(error);
    }
  }

  async rejectApplication(req, res, next) {
    try {
      const application = await ApplicationService.rejectApplication(req.params.id, req.user.id);
      res.status(200).json(new ApiResponse(200, application, 'Application rejected successfully'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ApplicationController();