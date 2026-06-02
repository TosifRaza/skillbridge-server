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
const ApiError = require('../utils/ApiError');
const uploadToCloudinary = require('../utils/cloudinaryUpload');

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
      serviceType // ADDED: Extract serviceType
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
          parseFloat(longitude),
          parseFloat(latitude)
        ],
        address
      },
      images: imageUrls,
      customer: customerId,
      serviceType: serviceType || 'local' // ADDED: Save serviceType
    });

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

    const jobs = await Job.find({
      customer: customerId
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
      .populate('customer', 'email');

    if (!job) {
      throw new ApiError(
        404,
        'Job not found'
      );
    }

    return job;
  }
}

module.exports = new JobService();