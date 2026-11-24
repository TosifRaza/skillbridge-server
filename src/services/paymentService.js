const mongoose = require('mongoose');
const Application = require('../models/Application');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const razorpayRoute = require('../integrations/razorpayRoute');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { getContractAmount } = require('../utils/contractPricing');

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

class PaymentService {
  calculateBreakdown(bidAmount) {
    const grossPaise = Math.round(Number(bidAmount) * 100);
    if (!Number.isFinite(grossPaise) || grossPaise < 100) throw new ApiError(400, 'Invalid contract amount');
    const commissionPercent = config.platformCommissionPercent;
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      throw new ApiError(500, 'Platform commission configuration is invalid');
    }
    const commissionPaise = Math.round((grossPaise * commissionPercent) / 100);
    return {
      grossPaise,
      commissionPaise,
      workerPaise: grossPaise - commissionPaise,
      grossAmount: grossPaise / 100,
      commissionAmount: commissionPaise / 100,
      workerAmount: (grossPaise - commissionPaise) / 100,
      commissionPercent,
    };
  }

  async getContract(jobId) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) throw new ApiError(400, 'Invalid job ID');
    const job = await Job.findById(jobId).populate('hiredProvider', 'fullName email payoutStatus');
    if (!job) throw new ApiError(404, 'Job not found');
    const application = await Application.findOne({ job: jobId, status: 'Accepted' });
    if (!application) throw new ApiError(409, 'This job does not have an accepted contract');
    if (toId(job.hiredProvider) && toId(job.hiredProvider) !== toId(application.worker)) {
      throw new ApiError(409, 'The assigned worker does not match the accepted proposal');
    }
    return { job, application };
  }

  assertParticipant(job, userId) {
    const id = userId.toString();
    if (toId(job.customer) !== id && toId(job.hiredProvider) !== id) throw new ApiError(403, 'You are not part of this contract');
  }

  serialize(payment, breakdown, job, currentUserId, application) {
    const status = payment?.status || 'NotStarted';
    const isCustomer = toId(job.customer) === currentUserId.toString();
    const isWorker = toId(job.hiredProvider) === currentUserId.toString();
    const priceMismatch = Boolean(payment && (
      Number(payment.grossAmount) !== Number(breakdown.grossAmount)
      || toId(payment.application) !== toId(application?._id)
      || toId(payment.worker) !== toId(application?.worker)
    ));
    return {
      id: payment?._id || null,
      jobId: job._id,
      status,
      currency: 'INR',
      jobBudget: Number(job.budget),
      priceBasis: breakdown.grossAmount === Number(job.budget) ? 'budget' : 'accepted_bid',
      contractAmount: breakdown.grossAmount,
      priceMismatch,
      grossAmount: payment?.grossAmount ?? breakdown.grossAmount,
      commissionPercent: payment?.commissionPercent ?? breakdown.commissionPercent,
      commissionAmount: payment?.commissionAmount ?? breakdown.commissionAmount,
      workerAmount: payment?.workerAmount ?? breakdown.workerAmount,
      fundedAt: payment?.fundedAt || null,
      workSubmittedAt: payment?.workSubmittedAt || job.workSubmittedAt || null,
      releasedAt: payment?.releasedAt || null,
      transferStatus: payment?.transferStatus || '',
      settlementStatus: payment?.settlementStatus || '',
      workerPayoutReady: job.hiredProvider?.payoutStatus === 'Active',
      canPay: !priceMismatch && isCustomer && ['Assigned'].includes(job.status) && ['NotStarted', 'Created', 'Failed'].includes(status),
      canSubmitWork: !priceMismatch && isWorker && job.status === 'In-Progress' && status === 'Funded',
      canRelease: !priceMismatch && isCustomer && status === 'WorkSubmitted',
      publicKey: razorpayRoute.getPublicKey(),
    };
  }

  async getStatus(jobId, userId) {
    const { job, application } = await this.getContract(jobId);
    this.assertParticipant(job, userId);
    const payment = await Payment.findOne({ job: jobId });
    const breakdown = this.calculateBreakdown(getContractAmount(job, application));
    return this.serialize(payment, breakdown, job, userId, application);
  }

  assertPaymentMatchesContract(payment, application, amount) {
    if (!payment) return;
    if (toId(payment.application) !== toId(application._id)
      || toId(payment.worker) !== toId(application.worker)
      || Number(payment.grossAmount) !== Number(amount)) {
      throw new ApiError(409, 'An earlier payment attempt does not match the accepted contract. Please contact support before paying.');
    }
  }

  async createOrder(jobId, customerId) {
    throw new ApiError(410, 'Contract pre-funding is no longer used. Complete the work first, then pay using the job QR.');
  }

  async verifyPayment(customerId, details) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = details;
    if (!orderId || !paymentId || !signature) throw new ApiError(400, 'Incomplete payment verification data');
    const payment = await Payment.findOne({ razorpayOrderId: orderId, customer: customerId });
    if (!payment) throw new ApiError(404, 'Payment order not found');
    if (payment.status !== 'Created') return payment;
    if (!razorpayRoute.verifyCheckoutSignature({ orderId, paymentId, signature })) throw new ApiError(400, 'Invalid payment signature');

    const providerPayment = await razorpayRoute.fetchPayment(paymentId);
    const expectedPaise = Math.round(payment.grossAmount * 100);
    if (providerPayment.order_id !== orderId || providerPayment.amount !== expectedPaise || providerPayment.currency !== 'INR' || providerPayment.status !== 'captured') {
      throw new ApiError(409, 'Payment has not been captured correctly');
    }

    const transfers = await razorpayRoute.fetchPaymentTransfers(paymentId);
    const transfer = transfers.items?.[0];
    payment.razorpayPaymentId = paymentId;
    payment.razorpayTransferId = transfer?.id || '';
    payment.transferStatus = transfer?.status || 'pending';
    payment.settlementStatus = transfer?.settlement_status || 'on_hold';
    payment.status = 'Funded';
    payment.fundedAt = new Date();
    await payment.save();
    await Job.updateOne({ _id: payment.job, status: 'Assigned' }, { $set: { status: 'In-Progress' } });
    return payment;
  }

  async submitWork(jobId, workerId) {
    const { job } = await this.getContract(jobId);
    if (toId(job.hiredProvider) !== workerId.toString()) throw new ApiError(403, 'Only the hired worker can submit this work');
    const payment = await Payment.findOne({ job: jobId, worker: workerId });
    if (!payment || payment.status !== 'Funded' || job.status !== 'In-Progress') throw new ApiError(409, 'This contract is not ready for work submission');
    const submittedAt = new Date();
    payment.status = 'WorkSubmitted';
    payment.workSubmittedAt = submittedAt;
    await payment.save();
    job.workSubmittedAt = submittedAt;
    await job.save();
    return payment;
  }

  async releasePayment(jobId, customerId) {
    const { job } = await this.getContract(jobId);
    if (toId(job.customer) !== customerId.toString()) throw new ApiError(403, 'Only the customer can approve and release this payment');
    const payment = await Payment.findOne({ job: jobId, customer: customerId });
    if (!payment || payment.status !== 'WorkSubmitted') throw new ApiError(409, 'The worker must submit the completed work before payment can be released');

    if (!payment.razorpayTransferId && payment.razorpayPaymentId) {
      const transfers = await razorpayRoute.fetchPaymentTransfers(payment.razorpayPaymentId);
      payment.razorpayTransferId = transfers.items?.[0]?.id || '';
    }
    if (!payment.razorpayTransferId) throw new ApiError(409, 'Worker transfer is still being prepared. Please try again shortly');

    payment.status = 'ReleasePending';
    await payment.save();
    try {
      const transfer = await razorpayRoute.releaseTransfer(payment.razorpayTransferId);
      payment.status = 'Released';
      payment.transferStatus = transfer.status || payment.transferStatus;
      payment.settlementStatus = transfer.settlement_status || 'pending';
      payment.releasedAt = new Date();
      await payment.save();
      job.status = 'Completed';
      job.completedAt = payment.releasedAt;
      job.paidAmount = payment.grossAmount;
      job.paymentMethod = 'razorpay_escrow';
      job.customerApproved = true;
      job.customerApprovedAt = payment.releasedAt;
      await job.save();
      return payment;
    } catch (error) {
      payment.status = 'WorkSubmitted';
      payment.failureReason = error.message;
      await payment.save();
      throw error;
    }
  }

  async handleWebhook(eventId, event) {
    try {
      await WebhookEvent.create({ provider: 'razorpay', eventId, eventType: event.event });
    } catch (error) {
      if (error.code === 11000) return { duplicate: true };
      throw error;
    }

    if (event.event === 'payment.captured') {
      const entity = event.payload?.payment?.entity;
      const payment = await Payment.findOne({ razorpayOrderId: entity?.order_id });
      if (payment && payment.status === 'Created') {
        payment.razorpayPaymentId = entity.id;
        payment.status = 'Funded';
        payment.fundedAt = new Date();
        await payment.save();
        await Job.updateOne({ _id: payment.job, status: 'Assigned' }, { $set: { status: 'In-Progress' } });
      }
    }

    if (typeof event.event === 'string' && event.event.startsWith('transfer.')) {
      const entity = event.payload?.transfer?.entity;
      if (entity) await Payment.updateOne(
        { $or: [{ razorpayTransferId: entity.id }, { razorpayPaymentId: entity.source }] },
        { $set: { razorpayTransferId: entity.id, transferStatus: entity.status || '', settlementStatus: entity.settlement_status || '' } },
      );
    }

    if (event.event === 'payment.failed') {
      const entity = event.payload?.payment?.entity;
      await Payment.updateOne({ razorpayOrderId: entity?.order_id, status: 'Created' }, { $set: { status: 'Failed', failureReason: entity?.error_description || 'Payment failed' } });
    }
    return { duplicate: false };
  }
}

module.exports = new PaymentService();
