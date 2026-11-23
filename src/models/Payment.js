const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, unique: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  grossAmount: { type: Number, required: true, min: 1 },
  commissionPercent: { type: Number, required: true, min: 0, max: 100 },
  commissionAmount: { type: Number, required: true, min: 0 },
  workerAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['Created', 'Funded', 'WorkSubmitted', 'ReleasePending', 'Released', 'Failed', 'Refunded', 'Disputed'],
    default: 'Created',
    index: true,
  },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, default: '', index: true },
  razorpayTransferId: { type: String, default: '', index: true },
  transferStatus: { type: String, default: '' },
  settlementStatus: { type: String, default: '' },
  fundedAt: { type: Date, default: null },
  workSubmittedAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null },
  failureReason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
