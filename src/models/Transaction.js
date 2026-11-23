const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null,
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  type: {
    type: String,
    enum: ['credit', 'debit', 'withdrawal', 'deposit', 'escrow_hold', 'escrow_release'],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  amount: {
    type: Number,
    required: true,
  },
  fee: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'InEscrow', 'Failed'],
    default: 'Completed',
    index: true,
  },
  destination: {
    method: { type: String, default: 'wallet' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
  },
  referenceId: {
    type: String,
    default: () => `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    index: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
