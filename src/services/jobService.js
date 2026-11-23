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
const ApiError = require('../utils/ApiError');
const uploadToCloudinary = require('../utils/cloudinaryUpload');
const mongoose = require('mongoose');

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

    return job;
  }

  /**
   * Worker marks work as completed and sends notification/message to customer
   */
  async submitWorkCompletion(jobId, workerId, { message = '' } = {}) {
    const job = await Job.findById(jobId).populate('customer', 'fullName email phone');
    if (!job) throw new ApiError(404, 'Job not found');

    let isHired = false;
    if (job.hiredProvider && job.hiredProvider.toString() === workerId.toString()) {
      isHired = true;
    } else {
      const Application = mongoose.models.Application || require('../models/Application');
      const acceptedApp = await Application.findOne({ job: jobId, worker: workerId, status: 'Accepted' });
      if (acceptedApp) {
        isHired = true;
        if (!job.hiredProvider) {
          job.hiredProvider = workerId;
        }
      }
    }

    if (!isHired) {
      throw new ApiError(403, 'Only the hired worker can mark this work as completed');
    }

    if (job.status === 'Completed') {
      throw new ApiError(400, 'This job is already completed');
    }

    job.workSubmittedAt = new Date();
    job.workCompletionMessage = message?.trim() || 'I have completed the work. Please inspect and approve.';
    job.status = 'In-Progress';
    await job.save();

    // If payment record exists, sync with it
    const Payment = mongoose.models.Payment || require('../models/Payment');
    await Payment.updateOne(
      { job: jobId },
      { $set: { status: 'WorkSubmitted', workSubmittedAt: job.workSubmittedAt } }
    );

    return job;
  }

  /**
   * Customer clicks "YES" to approve completed work, which unlocks/generates the payment QR option
   */
  async approveWork(jobId, customerId) {
    const job = await Job.findById(jobId).populate('hiredProvider', 'fullName email phone payoutDetails');
    if (!job) throw new ApiError(404, 'Job not found');

    if (job.customer.toString() !== customerId.toString()) {
      throw new ApiError(403, 'Only the job owner can approve this work');
    }

    if (!job.workSubmittedAt) {
      throw new ApiError(400, 'The worker has not marked this work as completed yet');
    }

    job.customerApproved = true;
    job.customerApprovedAt = new Date();
    await job.save();

    // Get amount from accepted application or fallback to job budget
    const Application = mongoose.models.Application || require('../models/Application');
    const application = await Application.findOne({ job: jobId, status: 'Accepted' }).populate('worker', 'fullName email phone payoutDetails');
    const amount = Number(application?.bidAmount || job.budget || 0);

    const worker = job.hiredProvider || application?.worker;
    const workerName = worker?.fullName || worker?.email?.split('@')[0] || 'SkillBridge Provider';
    const workerUpi = worker?.payoutDetails?.upiId || 'skillbridge@upi';

    const upiIntent = `upi://pay?pa=${encodeURIComponent(workerUpi)}&pn=${encodeURIComponent(workerName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`SkillBridge Work - ${job.title}`)}`;

    return {
      job,
      qrDetails: {
        amount,
        workerName,
        workerUpi,
        upiIntent,
        customerApproved: true,
        workSubmitted: true,
      },
    };
  }

  /**
   * Customer confirms payment via QR code or direct payment
   */
  async confirmQRPayment(jobId, customerId, { paymentMethod = 'upi_qr', utrNumber = '' } = {}) {
    const job = await Job.findById(jobId).populate('hiredProvider', 'fullName email phone payoutDetails');
    if (!job) throw new ApiError(404, 'Job not found');

    if (job.customer.toString() !== customerId.toString()) {
      throw new ApiError(403, 'Only the job owner can confirm payment');
    }

    if (job.status === 'Completed') {
      return { success: true, message: 'Job already completed', job };
    }

    const Application = mongoose.models.Application || require('../models/Application');
    const application = await Application.findOne({ job: jobId, status: 'Accepted' });
    const amount = Number(application?.bidAmount || job.budget || 0);

    const commissionPercent = 5;
    const commissionAmount = Math.round((amount * commissionPercent) / 100);
    const workerAmount = amount - commissionAmount;

    job.status = 'Completed';
    job.completedAt = new Date();
    job.customerApproved = true;
    job.paymentMethod = paymentMethod;
    job.paidAmount = amount;
    await job.save();

    // Credit Worker Wallet
    const Wallet = mongoose.models.Wallet || require('../models/Wallet');
    const Transaction = mongoose.models.Transaction || require('../models/Transaction');

    let workerWallet = await Wallet.findOne({ user: job.hiredProvider._id });
    if (!workerWallet) {
      workerWallet = await Wallet.create({ user: job.hiredProvider._id, balance: 0 });
    }

    workerWallet.balance += workerAmount;
    workerWallet.totalEarned += workerAmount;
    if (workerWallet.inEscrow >= workerAmount) {
      workerWallet.inEscrow -= workerAmount;
    } else {
      workerWallet.inEscrow = 0;
    }
    await workerWallet.save();

    // Log transaction
    const refId = utrNumber?.trim() || `UPI-QR-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await Transaction.create({
      wallet: workerWallet._id,
      user: job.hiredProvider._id,
      job: job._id,
      type: 'credit',
      title: `Payment Received via UPI QR - ${job.title}`,
      description: `Payment confirmed by client (${job.paymentMethod === 'upi_qr' ? 'Scanned UPI QR' : 'Direct Payment'}). UTR/Ref: ${refId}`,
      amount,
      fee: commissionAmount,
      netAmount: workerAmount,
      status: 'Completed',
      destination: {
        method: 'upi',
        upiId: job.hiredProvider?.payoutDetails?.upiId || '',
        accountHolderName: job.hiredProvider?.fullName || '',
      },
      referenceId: refId,
    });

    // Update Payment record if one exists
    const Payment = mongoose.models.Payment || require('../models/Payment');
    await Payment.updateOne(
      { job: jobId },
      { $set: { status: 'Released', releasedAt: job.completedAt, settlementStatus: 'completed' } }
    );

    return {
      success: true,
      job,
      transaction,
      receipt: {
        referenceId: refId,
        jobTitle: job.title,
        amount,
        workerAmount,
        commissionAmount,
        paidAt: job.completedAt,
        paymentMethod,
      },
    };
  }

  /**
   * Get QR payment details for a job
   */
  async getJobQRDetails(jobId, userId) {
    const job = await Job.findById(jobId)
      .populate('customer', 'fullName email phone')
      .populate('hiredProvider', 'fullName email phone payoutDetails');

    if (!job) throw new ApiError(404, 'Job not found');

    const Application = mongoose.models.Application || require('../models/Application');
    const application = await Application.findOne({ job: jobId, status: 'Accepted' }).populate('worker', 'fullName email phone payoutDetails');
    const amount = Number(application?.bidAmount || job.budget || 0);

    const worker = job.hiredProvider || application?.worker;
    const workerName = worker?.fullName || worker?.email?.split('@')[0] || 'SkillBridge Provider';
    const workerUpi = worker?.payoutDetails?.upiId || 'skillbridge@upi';

    const upiIntent = `upi://pay?pa=${encodeURIComponent(workerUpi)}&pn=${encodeURIComponent(workerName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`SkillBridge Work - ${job.title}`)}`;

    return {
      jobId: job._id,
      title: job.title,
      status: job.status,
      amount,
      workSubmitted: Boolean(job.workSubmittedAt),
      workSubmittedAt: job.workSubmittedAt,
      workCompletionMessage: job.workCompletionMessage || '',
      customerApproved: Boolean(job.customerApproved),
      customerApprovedAt: job.customerApprovedAt,
      isCompleted: job.status === 'Completed',
      paymentMethod: job.paymentMethod || '',
      worker: {
        id: worker?._id,
        name: workerName,
        email: worker?.email,
        phone: worker?.phone,
        upiId: workerUpi,
        hasUpi: Boolean(worker?.payoutDetails?.upiId),
      },
      customer: {
        id: job.customer?._id,
        name: job.customer?.fullName || job.customer?.email,
      },
      upiIntent,
    };
  }
}

module.exports = new JobService();