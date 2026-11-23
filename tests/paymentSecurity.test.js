const crypto = require('crypto');

describe('Razorpay Route payment safeguards', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_skillbridge';
    process.env.RAZORPAY_KEY_SECRET = 'test_checkout_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.PLATFORM_COMMISSION_PERCENT = '5';
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.PLATFORM_COMMISSION_PERCENT;
  });

  test('keeps exactly five percent and routes the remaining amount to the worker', () => {
    const paymentService = require('../src/services/paymentService');
    expect(paymentService.calculateBreakdown(1000)).toEqual({
      grossPaise: 100000,
      commissionPaise: 5000,
      workerPaise: 95000,
      grossAmount: 1000,
      commissionAmount: 50,
      workerAmount: 950,
      commissionPercent: 5,
    });
  });

  test('accepts a genuine checkout signature and rejects a modified signature', () => {
    const razorpayRoute = require('../src/integrations/razorpayRoute');
    const orderId = 'order_skillbridge';
    const paymentId = 'pay_skillbridge';
    const signature = crypto.createHmac('sha256', 'test_checkout_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(razorpayRoute.verifyCheckoutSignature({ orderId, paymentId, signature })).toBe(true);
    const modifiedSignature = `${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`;
    expect(razorpayRoute.verifyCheckoutSignature({ orderId, paymentId, signature: modifiedSignature })).toBe(false);
  });

  test('verifies the exact raw webhook body', () => {
    const razorpayRoute = require('../src/integrations/razorpayRoute');
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto.createHmac('sha256', 'test_webhook_secret')
      .update(rawBody)
      .digest('hex');

    expect(razorpayRoute.verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(razorpayRoute.verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature)).toBe(false);
  });
});
