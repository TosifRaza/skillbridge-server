const crypto = require('crypto');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const apiBaseUrl = 'https://api.razorpay.com/v1';

const assertConfigured = () => {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new ApiError(503, 'Razorpay payments are not configured yet');
  }
};

const request = async (path, { method = 'GET', body } = {}) => {
  assertConfigured();
  const authorization = Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.description || payload?.error?.reason || 'Razorpay request failed';
    throw new ApiError(502, message);
  }
  return payload;
};

const safeEqualHex = (left, right) => {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
  assertConfigured();
  const expected = crypto.createHmac('sha256', config.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!config.razorpayWebhookSecret) throw new ApiError(503, 'Razorpay webhook secret is not configured');
  const expected = crypto.createHmac('sha256', config.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
};

module.exports = {
  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
  fetchPayment: (paymentId) => request(`/payments/${encodeURIComponent(paymentId)}`),
  fetchLinkedAccount: (accountId) => request(`/accounts/${encodeURIComponent(accountId)}`),
  fetchPaymentTransfers: (paymentId) => request(`/payments/${encodeURIComponent(paymentId)}/transfers`),
  releaseTransfer: (transferId) => request(`/transfers/${encodeURIComponent(transferId)}`, { method: 'PATCH', body: { on_hold: false } }),
  verifyCheckoutSignature,
  verifyWebhookSignature,
  getPublicKey: () => config.razorpayKeyId || '',
};
