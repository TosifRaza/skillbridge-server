const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Worker ID is required'],
  },
  proposalMessage: {
    type: String,
    required: [true, 'Proposal message is required'],
    trim: true,
    maxlength: 2000,
  },
  bidAmount: {
    type: Number,
    required: [true, 'Bid amount is required'],
    min: [0, 'Bid amount cannot be negative'],
  },
  estimatedCompletionTime: {
    type: String, // E.g., "2 days", "1 week", "3 hours"
    required: [true, 'Estimated completion time is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Withdrawn'],
    default: 'Pending',
  },
}, { timestamps: true });

// Prevent duplicate applications: A worker can only apply once per job
applicationSchema.index({ job: 1, worker: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);