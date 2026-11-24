// const Job = require('../models/Job');
// const ApiError = require('../utils/ApiError');
// const uploadToCloudinary = require('../utils/cloudinaryUpload');

// class JobService {
//   /**
//    * Create a new job, upload images to Cloudinary
//    */
//   async createJob(customerId, jobData, files) {
//     const { title, description, category, budget, deadline, address, longitude, latitude } = jobData;

//     // 1. Upload images to Cloudinary (only if files exist)
//     let imageUrls = [];
//     if (files && files.length > 0) {
//       const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, 'SkillBridge/Jobs'));
//       const uploadedResults = await Promise.all(uploadPromises);
//       imageUrls = uploadedResults.map(result => ({ url: result.url, public_id: result.public_id }));
//     }

//     // 2. Create the job document
//     const job = await Job.create({
//       title,
//       description,
//       category,
//       budget,
//       deadline,
//       location: {
//         type: 'Point',
//         coordinates: [parseFloat(longitude), parseFloat(latitude)],
//         address,
//       },
//       images: imageUrls,
//       customer: customerId,
//     });

//     return job;
//   }

//   /**
//    * Update an existing job (Only if status is 'Open')
//    */
//   async updateJob(jobId, customerId, updateData) {
//     const job = await Job.findOne({ _id: jobId, customer: customerId });

//     if (!job) {
//       throw new ApiError(404, 'Job not found or you are not authorized to update it');
//     }

//     if (job.status !== 'Open') {
//       throw new ApiError(400, 'Cannot update a job that is already assigned or in progress');
//     }

//     Object.assign(job, updateData);
//     await job.save();
//     return job;
//   }

//   /**
//    * Delete a job (Only if status is 'Open')
//    */
//   async deleteJob(jobId, customerId) {
//     const job = await Job.findOne({ _id: jobId, customer: customerId });

//     if (!job) {
//       throw new ApiError(404, 'Job not found or you are not authorized to delete it');
//     }

//     if (job.status !== 'Open') {
//       throw new ApiError(400, 'Cannot delete a job that is already assigned or in progress');
//     }

//     await job.deleteOne();
//     return true;
//   }

//   /**
//    * Close a job (Customer decides to close it without hiring)
//    */
//   async closeJob(jobId, customerId) {
//     const job = await Job.findOne({ _id: jobId, customer: customerId });

//     if (!job) {
//       throw new ApiError(404, 'Job not found or you are not authorized');
//     }

//     job.status = 'Closed';
//     await job.save();
//     return job;
//   }

//   /**
//    * Get all jobs posted by the logged-in customer
//    */
//   async getMyJobs(customerId, query) {
//     const page = parseInt(query.page, 10) || 1;
//     const limit = parseInt(query.limit, 10) || 10;
//     const skip = (page - 1) * limit;

//     const jobs = await Job.find({ customer: customerId })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     const total = await Job.countDocuments({ customer: customerId });

//     return { jobs, total, page, pages: Math.ceil(total / limit) };
//   }

//   /**
//    * Browse available jobs for Workers (Search, Filter, Pagination)
//    */
//   async getAvailableJobs(query) {
//     const { keyword, category, minBudget, maxBudget, page = 1, limit = 10 } = query;
    
//     // Build filter object
//     const filter = { status: 'Open' }; // Workers only see Open jobs

//     if (keyword) {
//       filter.$or = [
//         { title: { $regex: keyword, $options: 'i' } },
//         { description: { $regex: keyword, $options: 'i' } },
//       ];
//     }

//     if (category) {
//       filter.category = category;
//     }

//     if (minBudget || maxBudget) {
//       filter.budget = {};
//       if (minBudget) filter.budget.$gte = Number(minBudget);
//       if (maxBudget) filter.budget.$lte = Number(maxBudget);
//     }

//     const skip = (page - 1) * limit;

//     const jobs = await Job.find(filter)
//       .populate('customer', 'email role') // Show basic customer info
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit));

//     const total = await Job.countDocuments(filter);

//     return { jobs, total, page: Number(page), pages: Math.ceil(total / limit) };
//   }

//   /**
//    * Get a single job by ID
//    */
//   async getJobById(jobId) {
//     const job = await Job.findById(jobId).populate('customer', 'email');
//     if (!job) {
//       throw new ApiError(404, 'Job not found');
//     }
//     return job;
//   }
// }

// module.exports = new JobService();








const Job = require('../models/Job');
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const uploadToCloudinary = require('../utils/cloudinaryUpload');
const mongoose = require('mongoose');
const { getContractAmount } = require('../utils/contractPricing');

class JobService {
  /**
   * Create a new job, upload images to Cloudinary
   */
  async createJob(customerId, jobData, files) {
    const {
      title,
      description,
      category,
      budget,
      deadline,
      address,
      longitude,
      latitude,
      serviceType, // ADDED: Extract serviceType
      hiredProvider
    } = jobData;

    // Upload images to Cloudinary
    let imageUrls = [];

    if (files && files.length > 0) {
      const uploadPromises = files.map(file =>
        uploadToCloudinary(file.buffer, 'SkillBridge/Jobs')
      );

      const uploadedResults = await Promise.all(uploadPromises);

      imageUrls = uploadedResults.map(result => ({
        url: result.url,
        public_id: result.public_id
      }));
    }

    const isDirectHire = hiredProvider && mongoose.Types.ObjectId.isValid(hiredProvider);

    // Create Job
    const job = await Job.create({
      title,
      description,
      category,
      budget,
      contractAmount: Number(budget),
      deadline,
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(longitude) || 88.3639,
          parseFloat(latitude) || 22.5726
        ],
        address: address || 'Service Address'
      },
      images: imageUrls,
      customer: customerId,
      serviceType: serviceType || 'local',
      bookingType: isDirectHire ? 'direct' : 'marketplace',
      hiredProvider: isDirectHire ? hiredProvider : null,
      status: isDirectHire ? 'Assigned' : 'Open'
    });

    // If direct hire, create an auto-accepted Application record
    if (isDirectHire) {
      await Application.create({
        job: job._id,
        worker: hiredProvider,
        proposalMessage: 'Direct booking by customer.',
        bidAmount: budget,
        estimatedCompletionTime: 'As agreed with customer',
        status: 'Accepted'
      });
    }

    return job;
  }

  /**
   * Update an existing job
   * Only if status is Open
   */
  async updateJob(jobId, customerId, updateData) {
    const job = await Job.findOne({
      _id: jobId,
      customer: customerId
    });

    if (!job) {
      throw new ApiError(
        404,
        'Job not found or you are not authorized to update it'
      );
    }

    if (job.status !== 'Open') {
      throw new ApiError(
        400,
        'Cannot update a job that is already assigned or in progress'
      );
    }

    Object.assign(job, updateData);

    await job.save();

    return job;
  }

  /**
   * Delete a job
   * Only if status is Open
   */
  async deleteJob(jobId, customerId) {
    const job = await Job.findOne({
      _id: jobId,
      customer: customerId
    });

    if (!job) {
      throw new ApiError(
        404,
        'Job not found or you are not authorized to delete it'
      );
    }

    if (job.status !== 'Open') {
      throw new ApiError(
        400,
        'Cannot delete a job that is already assigned or in progress'
      );
    }

    await job.deleteOne();

    return true;
  }

  /**
   * Close a job
   */
  async closeJob(jobId, customerId) {
    const job = await Job.findOne({
      _id: jobId,
      customer: customerId
    });

    if (!job) {
      throw new ApiError(
        404,
        'Job not found or you are not authorized'
      );
    }

    job.status = 'Closed';

    await job.save();

    return job;
  }

  /**
   * Get all jobs posted by logged-in customer
   */
  async getMyJobs(customerId, query) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;

    const skip = (page - 1) * limit;

    const rawJobs = await Job.find({
      customer: customerId
    })
      .populate('hiredProvider', 'email fullName avatar phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const Application = mongoose.models.Application || require('../models/Application');
    const jobIds = rawJobs.map(j => j._id);
    const proposalCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    proposalCounts.forEach(p => {
      countMap[p._id.toString()] = p.count;
    });

    const jobs = rawJobs.map(j => ({
      ...j,
      contractAmount: Number(j.budget),
      proposalCount: countMap[j._id.toString()] || 0,
    }));

    const total = await Job.countDocuments({
      customer: customerId
    });

    return {
      jobs,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Browse available jobs for Workers
   * Search + Category + City + Budget + Pagination
   */
  async getAvailableJobs(query) {
    const {
      keyword,
      category,
      serviceType,
      city,
      minBudget,
      maxBudget,
      page = 1,
      limit = 10
    } = query;

    // Workers can only see open jobs
    const filter = {
      status: 'Open'
    };

    // Search by title or description
    if (keyword) {
      filter.$or = [
        {
          title: {
            $regex: keyword,
            $options: 'i'
          }
        },
        {
          description: {
            $regex: keyword,
            $options: 'i'
          }
        }
      ];
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Honor the Local / Digital filter controls in the worker job browser.
    if (['local', 'digital'].includes(serviceType)) {
      filter.serviceType = serviceType;
    }

    // Filter by city
    if (city) {
      filter['location.address'] = {
        $regex: city,
        $options: 'i'
      };
    }

    // Filter by budget range
    if (minBudget || maxBudget) {
      filter.budget = {};

      if (minBudget) {
        filter.budget.$gte = Number(minBudget);
      }

      if (maxBudget) {
        filter.budget.$lte = Number(maxBudget);
      }
    }

    const skip =
      (Number(page) - 1) * Number(limit);

    const jobs = await Job.find(filter)
      .populate('customer', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total =
      await Job.countDocuments(filter);

    return {
      jobs,
      total,
      page: Number(page),
      pages: Math.ceil(
        total / Number(limit)
      )
    };
  }

  /**
   * Get single job by ID
   */
    async getJobById(jobId) {
    const job = await Job.findById(jobId)
      .populate('customer', 'email fullName avatar') 
      .populate('hiredProvider', 'email fullName avatar'); // Now it won't crash!

    if (!job) {
      throw new ApiError(404, 'Job not found');
    }

    job.contractAmount = Number(job.budget);
    return job;
  }

  /**
   * Worker marks work as completed and sends notification/message to customer
   */
  async submitWorkCompletion(jobId, workerId, completionData = {}) {
    const job = await Job.findById(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    const acceptedApplication = await Application.findOne({ job: jobId, status: 'Accepted' }).select('worker');
    const assignedWorker = job.hiredProvider || acceptedApplication?.worker;
    if (String(assignedWorker?._id || assignedWorker || '') !== String(workerId)) {
      throw new ApiError(403, 'Only the assigned worker can submit completed work');
    }
    if (!['Assigned', 'In-Progress'].includes(job.status)) {
      throw new ApiError(409, 'This job is not accepting a work completion update');
    }
    if (job.workSubmittedAt) return job;

    const completionMessage = String(completionData.message || '').trim().slice(0, 1000);
    job.status = 'In-Progress';
    job.workSubmittedAt = new Date();
    job.workCompletionMessage = completionMessage;
    await job.save();
    return job;
  }

  /**
   * Customer clicks "YES" to approve completed work, which unlocks/generates the payment QR option
   */
  async approveWork(jobId, customerId) {
    const job = await Job.findOne({ _id: jobId, customer: customerId });
    if (!job) throw new ApiError(404, 'Job not found or you are not authorized');
    if (!job.workSubmittedAt) throw new ApiError(409, 'The worker must submit completed work first');
    job.customerApproved = true;
    job.customerApprovedAt = new Date();
    await job.save();
    return job;
  }

  /**
   * Customer confirms payment via QR code or direct payment
   */
  async confirmQRPayment(jobId, customerId, paymentData = {}) {
    const job = await Job.findOne({ _id: jobId, customer: customerId });
    if (!job) throw new ApiError(404, 'Job not found or you are not authorized');
    if (!job.workSubmittedAt) throw new ApiError(409, 'The worker must submit completed work before payment');
    if (job.paymentReference) return job;
    const existingPayment = await Payment.findOne({ job: jobId });
    if (existingPayment) throw new ApiError(409, 'A protected checkout is already recorded for this job. Do not make a second payment.');

    const reference = String(paymentData.reference || paymentData.utr || '').trim();
    if (!/^[A-Za-z0-9-]{6,64}$/.test(reference)) {
      throw new ApiError(400, 'Enter the UPI transaction reference (6–64 letters or numbers)');
    }
    const acceptedApplication = await Application.findOne({ job: jobId, status: 'Accepted' });
    const amount = getContractAmount(job, acceptedApplication);
    if (!Number.isFinite(amount) || amount < 1) throw new ApiError(409, 'The job does not have a valid posted price');

    job.paymentReference = reference;
    job.customerApproved = true;
    job.customerApprovedAt = new Date();
    await job.save();
    return job;
  }

  async confirmUPIReceived(jobId, workerId) {
    const job = await Job.findById(jobId);
    if (!job) throw new ApiError(404, 'Job not found');
    const acceptedApplication = await Application.findOne({ job: jobId, status: 'Accepted' }).select('worker');
    const assignedWorker = job.hiredProvider || acceptedApplication?.worker;
    if (String(assignedWorker?._id || assignedWorker || '') !== String(workerId)) {
      throw new ApiError(403, 'Only the assigned worker can confirm receipt');
    }
    if (!job.paymentReference || !job.customerApproved) {
      throw new ApiError(409, 'The customer must submit the UPI reference first');
    }
    if (job.status === 'Completed') return job;
    const amount = getContractAmount(job, acceptedApplication);
    job.status = 'Completed';
    job.paidAmount = amount;
    job.paymentMethod = 'upi_qr_both_confirmed';
    job.workerPaymentConfirmedAt = new Date();
    job.completedAt = new Date();
    await job.save();
    return job;
  }

  /**
   * Get QR payment details for a job
   */
  async getJobQRDetails(jobId, userId) {
    const job = await Job.findById(jobId)
      .populate('customer', 'fullName email phone')
      .populate('hiredProvider', 'fullName email phone payoutDetails');

    if (!job) throw new ApiError(404, 'Job not found');

    const application = await Application.findOne({ job: jobId, status: 'Accepted' }).populate('worker', 'fullName email phone payoutDetails');
    const isCustomer = String(job.customer?._id || job.customer) === String(userId);
    const assignedWorker = job.hiredProvider || application?.worker;
    const isAssignedWorker = String(assignedWorker?._id || assignedWorker || '') === String(userId);
    if (!isCustomer && !isAssignedWorker) throw new ApiError(403, 'You are not part of this job');
    const existingPayment = await Payment.findOne({ job: jobId }).select('status grossAmount');
    const amount = getContractAmount(job, application);

    const worker = job.hiredProvider || application?.worker;
    const workerName = worker?.fullName || worker?.email?.split('@')[0] || 'SkillBridge Provider';
    const workerUpi = worker?.payoutDetails?.upiId || '';
    const escrowAlreadyFunded = Boolean(existingPayment && ['Funded', 'WorkSubmitted', 'ReleasePending', 'Released'].includes(existingPayment.status));
    const legacyCheckoutExists = Boolean(existingPayment);

    const workSubmitted = Boolean(job.workSubmittedAt);
    const upiIntent = isCustomer && workSubmitted && workerUpi && !legacyCheckoutExists && !job.paymentReference && job.status !== 'Completed'
      ? `upi://pay?pa=${encodeURIComponent(workerUpi)}&pn=${encodeURIComponent(workerName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`SkillBridge Job ${String(job._id).slice(-8)}`)}`
      : '';

    return {
      jobId: job._id,
      title: job.title,
      status: job.status,
      amount,
      contractAmount: amount,
      budget: Number(job.budget),
      workSubmitted,
      workSubmittedAt: job.workSubmittedAt,
      workCompletionMessage: job.workCompletionMessage || '',
      customerApproved: Boolean(job.customerApproved),
      customerApprovedAt: job.customerApprovedAt,
      isCompleted: job.status === 'Completed',
      paidAmount: Number(job.paidAmount) || 0,
      paymentReference: job.paymentReference || '',
      paymentConfirmedAt: job.customerApprovedAt || null,
      customerReportedPayment: Boolean(job.paymentReference && job.customerApproved),
      workerPaymentConfirmedAt: job.workerPaymentConfirmedAt || null,
      escrowAlreadyFunded,
      legacyCheckoutExists,
      paymentMethod: job.paymentMethod || '',
      worker: worker ? {
        id: worker?._id,
        name: workerName,
        email: worker?.email,
        phone: worker?.phone,
        upiId: isCustomer && workSubmitted ? workerUpi : '',
        hasUpi: Boolean(workerUpi),
      } : null,
      customer: {
        id: job.customer?._id,
        name: job.customer?.fullName || job.customer?.email,
      },
      upiIntent,
    };
  }
}

module.exports = new JobService();
