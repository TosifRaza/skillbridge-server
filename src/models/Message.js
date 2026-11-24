const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true, // Index for faster history lookups
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
  },
  imageUrls: [{
    type: String,
  }],
  attachment: {
    name: String,
    size: Number,
    data: { type: Buffer, select: false },
  },
  type: {
    type: String,
    enum: ['text', 'call'],
    default: 'text',
  },
  call: {
    callId: { type: String },
    callType: { type: String, enum: ['audio', 'video'] },
    status: { type: String, enum: ['ringing', 'ongoing', 'completed', 'missed', 'declined', 'cancelled'] },
    startedAt: { type: Date },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

messageSchema.index({ 'call.callId': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Message', messageSchema);
