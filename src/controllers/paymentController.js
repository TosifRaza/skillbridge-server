const crypto = require('crypto');
const PaymentService = require('../services/paymentService');
const razorpayRoute = require('../integrations/razorpayRoute');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

class PaymentController {
  async getStatus(req, res, next) {
    try {
      const payment = await PaymentService.getStatus(req.params.jobId, req.user.id);
      res.status(200).json(new ApiResponse(200, payment, 'Contract payment fetched successfully'));
    } catch (error) { next(error); }
  }

  async createOrder(req, res, next) {
    try {
      const payment = await PaymentService.createOrder(req.params.jobId, req.user.id);
      res.status(201).json(new ApiResponse(201, payment, 'Secure payment order created'));
    } catch (error) { next(error); }
  }

  async verify(req, res, next) {
    try {
      const payment = await PaymentService.verifyPayment(req.user.id, req.body);
      res.status(200).json(new ApiResponse(200, payment, 'Payment captured and protected successfully'));
    } catch (error) { next(error); }
  }

  async submitWork(req, res, next) {
    try {
      const payment = await PaymentService.submitWork(req.params.jobId, req.user.id);
      res.status(200).json(new ApiResponse(200, payment, 'Work submitted for customer approval'));
    } catch (error) { next(error); }
  }

  async release(req, res, next) {
    try {
      const payment = await PaymentService.releasePayment(req.params.jobId, req.user.id);
      res.status(200).json(new ApiResponse(200, payment, 'Worker payment released successfully'));
    } catch (error) { next(error); }
  }

  async webhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      if (!Buffer.isBuffer(req.body) || !razorpayRoute.verifyWebhookSignature(req.body, signature)) {
        throw new ApiError(400, 'Invalid webhook signature');
      }
      const event = JSON.parse(req.body.toString('utf8'));
      const eventId = req.headers['x-razorpay-event-id'] || crypto.createHash('sha256').update(req.body).digest('hex');
      await PaymentService.handleWebhook(eventId, event);
      res.status(200).json({ success: true });
    } catch (error) { next(error); }
  }
}

module.exports = new PaymentController();
