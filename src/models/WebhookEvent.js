const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  provider: { type: String, enum: ['razorpay'], required: true },
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
}, { timestamps: true });

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
