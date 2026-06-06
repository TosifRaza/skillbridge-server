// const Application = require('../models/Application');
// const Job = require('../models/Job');
// const ApiError = require('../utils/ApiError');

// class ApplicationService {
//   /**
//    * Worker applies to a job
//    */
//   async applyToJob(workerId, applicationData) {
//     const { job: jobId, proposalMessage, bidAmount, estimatedCompletionTime } = applicationData;

//     // 1. Check if job exists and is open
//     const job = await Job.findById(jobId);
//     if (!job) throw new ApiError(404, 'Job not found');
//     if (job.status !== 'Open') throw new ApiError(400, 'Cannot apply to a job that is not open');
//     if (job.customer.toString() === workerId.toString()) throw new ApiError(400, 'You cannot apply to your own job');

//     // 2. Create application (mongoose unique index handles duplicate checks natively, but we catch it gracefully)
//     try {
//       const application = await Application.create({
//         job: jobId,
//         worker: workerId,
//         proposalMessage,
//         bidAmount,
//         estimatedCompletionTime,
//       });
//       return application;
//     } catch (error) {
//       if (error.code === 11000) {
//         throw new ApiError(409, 'You have already applied to this job');
//       }
//       throw error;
//     }
//   }

//   /**
//    * Worker withdraws their application
//    */
//   async withdrawApplication(applicationId, workerId) {
//     const application = await Application.findOne({ _id: applicationId, worker: workerId });

//     if (!application) throw new ApiError(404, 'Application not found or unauthorized');
//     if (application.status !== 'Pending') throw new ApiError(400, 'Only pending applications can be withdrawn');
//      // FIX: Delete the application entirely so the unique index is freed up for re-application
    

//     application.status = 'Withdrawn';
//     await application.deleteOne();
//     // await application.save();
//     return { _id: applicationId }; 
//   }

//   /**
//    * Worker views all jobs they applied to
//    */
//   async getMyApplications(workerId, query) {
//     const page = parseInt(query.page, 10) || 1;
//     const limit = parseInt(query.limit, 10) || 10;
//     const skip = (page - 1) * limit;

//     const applications = await Application.find({ worker: workerId })
//       .populate({
//         path: 'job',
//         select: 'title budget status location deadline',
//       })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     const total = await Application.countDocuments({ worker: workerId });

//     return { applications, total, page, pages: Math.ceil(total / limit) };
//   }

//   /**
//    * Customer views applications for a specific job they posted
//    */
//   async getJobApplications(jobId, customerId) {
//     // Verify the customer owns this job
//     const job = await Job.findOne({ _id: jobId, customer: customerId });
//     if (!job) throw new ApiError(404, 'Job not found or you are not the owner');

//     const applications = await Application.find({ job: jobId })
//       .populate('worker', 'email role') // Populate basic worker info
//       .sort({ createdAt: -1 });

//     return applications;
//   }

//   /**
//    * Customer accepts an application (CRITICAL BUSINESS LOGIC)
//    */
//   async acceptApplication(applicationId, customerId) {
//     const application = await Application.findById(applicationId).populate('job');

//     if (!application) throw new ApiError(404, 'Application not found');

//     // Verify the customer owns the job related to this application
//     if (application.job.customer.toString() !== customerId.toString()) {
//       throw new ApiError(403, 'You are not authorized to accept this application');
//     }

//     // Verify the application is still pending
//     if (application.status !== 'Pending') {
//       throw new ApiError(400, 'Only pending applications can be accepted');
//     }

//     // Verify the job is still open
//     if (application.job.status !== 'Open') {
//       throw new ApiError(400, 'Job is no longer open for hiring');
//     }

//     // 1. Accept the current application
//     application.status = 'Accepted';
//     await application.save();

//     // 2. Update the Job status and assign the worker
//     const job = await Job.findById(application.job._id);
//     job.status = 'Assigned';
//     job.hiredProvider = application.worker;
//     await job.save();

//     // 3. Reject all other pending applications for this job automatically
//     await Application.updateMany(
//       { job: job._id, _id: { $ne: applicationId }, status: 'Pending' },
//       { status: 'Rejected' }
//     );

//     return application;
//   }

//   /**
//    * Customer rejects a specific application
//    */
//   async rejectApplication(applicationId, customerId) {
//     const application = await Application.findById(applicationId).populate('job');

//     if (!application) throw new ApiError(404, 'Application not found');

//     if (application.job.customer.toString() !== customerId.toString()) {
//       throw new ApiError(403, 'You are not authorized to reject this application');
//     }

//     if (application.status !== 'Pending') {
//       throw new ApiError(400, 'Only pending applications can be rejected');
//     }

//     application.status = 'Rejected';
//     await application.save();

//     return application;
//   }
// }

// module.exports = new ApplicationService();
const Application = require('../models/Application');
const Job = require('../models/Job');
const ApiError = require('../utils/ApiError');

class ApplicationService {
  /**
   * Worker applies to a job
   */
  async applyToJob(workerId, applicationData) {
    const { job: jobId, proposalMessage, bidAmount, estimatedCompletionTime } = applicationData;

    // 1. Check if job exists and is open
    const job = await Job.findById(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    if (job.status !== 'Open') throw new ApiError(400, 'Cannot apply to a job that is not open');
    if (job.customer.toString() === workerId.toString()) throw new ApiError(400, 'You cannot apply to your own job');

    // 2. Check if an application already exists for this worker + job combo
    let application = await Application.findOne({ job: jobId, worker: workerId });

    if (application) {
      // FIX: If they previously withdrew or were rejected, allow them to re-apply by updating the existing document
      if (application.status === 'Withdrawn' || application.status === 'Rejected') {
        application.proposalMessage = proposalMessage;
        application.bidAmount = bidAmount;
        application.estimatedCompletionTime = estimatedCompletionTime;
        application.status = 'Pending'; // Reset status to Pending
        await application.save();
        return application;
      } else {
        // If it's Pending or Accepted, they can't apply again
        throw new ApiError(409, 'You have already applied to this job');
      }
    }

    // 3. No existing application found, create a new one
    application = await Application.create({
      job: jobId,
      worker: workerId,
      proposalMessage,
      bidAmount,
      estimatedCompletionTime,
    });
    
    return application;
  }

  /**
   * Worker withdraws their application
   */
  // async withdrawApplication(applicationId, workerId) {
  //   const application = await Application.findOne({ _id: applicationId, worker: workerId });

  //   if (!application) throw new ApiError(404, 'Application not found or unauthorized');
  //   if (application.status !== 'Pending') throw new ApiError(400, 'Only pending applications can be withdrawn');

  //   // FIX: Update status to 'Withdrawn' and SAVE. Do NOT delete, so it shows in Worker history.
  //   application.status = 'Withdrawn';
  //   await application.save(); 
    
  //   return application; // Return the full application object so Redux state updates correctly
  // }


    /**
   * Worker withdraws their application OR cancels an active contract
   */
  async withdrawApplication(applicationId, workerId) {
    const application = await Application.findOne({ _id: applicationId, worker: workerId });

    if (!application) throw new ApiError(404, 'Application not found or unauthorized');

    // FIX: Allow withdrawal for both 'Pending' and 'Accepted' applications
    if (!['Pending', 'Accepted'].includes(application.status)) {
      throw new ApiError(400, 'Only pending or active applications can be withdrawn/canceled');
    }

    // Check if the application was accepted (meaning it's an active contract)
    const wasAccepted = application.status === 'Accepted';

    // Update application status
    application.status = 'Withdrawn';
    await application.save();

    // If it was an active contract, we must revert the Job status so other workers can apply again
    if (wasAccepted) {
      const job = await Job.findById(application.job);
      if (job) {
        job.status = 'Open';
        job.hiredProvider = null; // Remove the hired worker
        await job.save();
      }
    }

    return application;
  }

  /**
   * Worker views all jobs they applied to
   */
  async getMyApplications(workerId, query) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const applications = await Application.find({ worker: workerId })

      .populate({
        path: 'job',
        
        // select: 'title budget status location deadline',
        select: 'title budget status location deadline customer', // ADD customer here
        populate: {
          path: 'customer', // NESTED POPULATE to get customer details
          select: 'email fullName'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Application.countDocuments({ worker: workerId });

    return { applications, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Customer views applications for a specific job they posted
   */
  async getJobApplications(jobId, customerId) {
    // Verify the customer owns this job
    const job = await Job.findOne({ _id: jobId, customer: customerId });
    if (!job) throw new ApiError(404, 'Job not found or you are not the owner');

    const applications = await Application.find({ job: jobId })
      .populate('worker', 'email role') // Populate basic worker info
      .sort({ createdAt: -1 });

    return applications;
  }

  /**
   * Customer accepts an application (CRITICAL BUSINESS LOGIC)
   */
  async acceptApplication(applicationId, customerId) {
    const application = await Application.findById(applicationId).populate('job');

    if (!application) throw new ApiError(404, 'Application not found');

    // Verify the customer owns the job related to this application
    if (application.job.customer.toString() !== customerId.toString()) {
      throw new ApiError(403, 'You are not authorized to accept this application');
    }

    // Verify the application is still pending
    if (application.status !== 'Pending') {
      throw new ApiError(400, 'Only pending applications can be accepted');
    }

    // Verify the job is still open
    if (application.job.status !== 'Open') {
      throw new ApiError(400, 'Job is no longer open for hiring');
    }

    // 1. Accept the current application
    application.status = 'Accepted';
    await application.save();

    // 2. Update the Job status and assign the worker
    const job = await Job.findById(application.job._id);
    job.status = 'Assigned';
    job.hiredProvider = application.worker;
    await job.save();

    // 3. Reject all other pending applications for this job automatically
    await Application.updateMany(
      { job: job._id, _id: { $ne: applicationId }, status: 'Pending' },
      { status: 'Rejected' }
    );

    return application;
  }

  /**
   * Customer rejects a specific application
   */
  async rejectApplication(applicationId, customerId) {
    const application = await Application.findById(applicationId).populate('job');

    if (!application) throw new ApiError(404, 'Application not found');

    if (application.job.customer.toString() !== customerId.toString()) {
      throw new ApiError(403, 'You are not authorized to reject this application');
    }

    if (application.status !== 'Pending') {
      throw new ApiError(400, 'Only pending applications can be rejected');
    }

    application.status = 'Rejected';
    await application.save();

    return application;
  }
}

module.exports = new ApplicationService();