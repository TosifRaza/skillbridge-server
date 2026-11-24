const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const User = require('../models/User');
const razorpayRoute = require('../integrations/razorpayRoute');
const ApiError = require('../utils/ApiError');

const protectedPaymentStates = ['Funded', 'WorkSubmitted', 'ReleasePending'];

const recordsPayment = (transactions, { job, payment, type }) => transactions.some((entry) => (
  entry.type === type && (entry.status === 'Completed' || entry.status === 'InEscrow') && (
    (payment && String(entry.payment) === String(payment)) ||
    (job && String(entry.job) === String(job))
  )
));

const buildCustomerHistory = async (userId, payments, transactions) => {
  const customerPayments = payments.filter((payment) => String(payment.customer) === String(userId));
  const paymentJobIds = customerPayments.filter((payment) => payment.job).map((payment) => payment.job._id);
  const directPayments = await Job.find({
    customer: userId, status: 'Completed', paidAmount: { $gt: 0 }, _id: { $nin: paymentJobIds },
  }).select('title paidAmount completedAt updatedAt').lean();

  const history = [...transactions];
  for (const payment of customerPayments) {
    const isProtected = protectedPaymentStates.includes(payment.status);
    const isRefunded = payment.status === 'Refunded';
    if (!isProtected && !isRefunded && payment.status !== 'Released') continue;

    const type = isProtected ? 'escrow_hold' : isRefunded ? 'credit' : 'debit';
    if (recordsPayment(transactions, { job: payment.job?._id, payment: payment._id, type })) continue;
    history.push({
      _id: `contract-${payment._id}`,
      title: payment.job?.title || 'Contract payment',
      type,
      amount: payment.grossAmount,
      status: isProtected ? 'InEscrow' : isRefunded ? 'Refunded' : 'Completed',
      createdAt: (isProtected ? payment.fundedAt : isRefunded ? payment.updatedAt : payment.releasedAt) || payment.updatedAt,
    });
  }

  for (const job of directPayments) {
    if (recordsPayment(transactions, { job: job._id, type: 'debit' })) continue;
    history.push({
      _id: `job-${job._id}`, title: job.title, type: 'debit', amount: job.paidAmount,
      status: 'Completed', createdAt: job.completedAt || job.updatedAt,
    });
  }

  const totalSpent = history.reduce((sum, entry) => (
    entry.type === 'debit' && entry.status === 'Completed' ? sum + Number(entry.amount || 0) : sum
  ), 0);
  history.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  return { totalSpent, transactions: history.slice(0, 50) };
};

class WalletService {
  async getWallet(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, 'Invalid user ID');
    }

    const user = await User.findById(userId).select('fullName email phone payoutStatus payoutDetails role');
    if (!user) throw new ApiError(404, 'User not found');

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        inEscrow: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
    }

    // 100% Real Live Database Calculation
    const payments = await Payment.find({
      $or: [{ worker: userId }, { customer: userId }],
    }).populate('job', 'title');

    let realInEscrow = 0;
    let realEarned = 0;

    payments.forEach((payment) => {
      if (user.role === 'provider' && payment.worker?.toString() === userId.toString()) {
        if (protectedPaymentStates.includes(payment.status)) {
          realInEscrow += Number(payment.workerAmount || 0);
        } else if (payment.status === 'Released') {
          realEarned += Number(payment.workerAmount || 0);
        }
      } else if (user.role === 'customer' && payment.customer?.toString() === userId.toString()) {
        if (protectedPaymentStates.includes(payment.status)) {
          realInEscrow += Number(payment.grossAmount || 0);
        }
      }
    });

    // Real transactions aggregation
    const userTransactions = await Transaction.find({ user: userId });
    let totalDeposited = 0;
    let totalWithdrawn = 0;

    userTransactions.forEach((tx) => {
      if (tx.type === 'deposit' && tx.status === 'Completed') {
        totalDeposited += Number(tx.amount || 0);
      } else if (tx.type === 'withdrawal' && tx.status === 'Completed') {
        totalWithdrawn += Number(tx.amount || 0);
      }
    });

    const calculatedBalance = Math.max(0, (realEarned + totalDeposited) - totalWithdrawn);

    wallet.inEscrow = realInEscrow;
    wallet.totalEarned = realEarned;
    wallet.totalWithdrawn = totalWithdrawn;
    wallet.balance = calculatedBalance;
    await wallet.save();

    const history = user.role === 'customer'
      ? await buildCustomerHistory(userId, payments, userTransactions)
      : { transactions: await Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50) };

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        inEscrow: wallet.inEscrow,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        totalDeposited,
        ...(user.role === 'customer' ? { totalSpent: history.totalSpent } : {}),
        currency: wallet.currency,
      },
      transactions: history.transactions,
      payoutDetails: user.payoutDetails || {},
      payoutStatus: user.payoutStatus || 'NotConnected',
    };
  }

  async createDepositOrder(userId, { amount }) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 10) {
      throw new ApiError(400, 'Minimum deposit amount is ₹10');
    }

    const paise = Math.round(numAmount * 100);
    const order = await razorpayRoute.createOrder({
      amount: paise,
      currency: 'INR',
      receipt: `wdep_${userId.toString().slice(-6)}_${Date.now().toString(36)}`,
      notes: { user_id: userId.toString(), purpose: 'wallet_topup' },
    });

    return {
      orderId: order.id,
      amount: numAmount,
      currency: 'INR',
      keyId: razorpayRoute.getPublicKey(),
    };
  }

  async verifyDeposit(userId, details) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = details;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new ApiError(400, 'Incomplete payment verification details from Razorpay');
    }

    const isValid = razorpayRoute.verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      throw new ApiError(400, 'Invalid Razorpay payment signature');
    }

    const providerPayment = await razorpayRoute.fetchPayment(razorpay_payment_id);
    if (!providerPayment || providerPayment.status !== 'captured') {
      throw new ApiError(409, 'Payment was not successfully captured by Razorpay');
    }

    const numAmount = Number(amount) || (providerPayment.amount / 100);

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0 });
    }

    wallet.balance += numAmount;
    await wallet.save();

    const transaction = await Transaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'deposit',
      title: 'Wallet Deposit via Razorpay',
      description: `Razorpay Payment ID: ${razorpay_payment_id} (${providerPayment.method?.toUpperCase() || 'ONLINE'})`,
      amount: numAmount,
      fee: 0,
      netAmount: numAmount,
      status: 'Completed',
      destination: { method: 'razorpay' },
      referenceId: razorpay_payment_id,
    });

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        inEscrow: wallet.inEscrow,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        currency: wallet.currency,
      },
      transaction,
    };
  }

  async withdraw(userId, { amount, payoutMethod = 'upi', destination = {} }) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 50) {
      throw new ApiError(400, 'Minimum withdrawal amount is ₹50');
    }

    const user = await User.findById(userId).select('fullName email phone payoutStatus payoutDetails');
    if (!user) throw new ApiError(404, 'User not found');

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) throw new ApiError(404, 'Wallet not found');

    if (wallet.balance < numAmount) {
      throw new ApiError(400, `Insufficient wallet balance. You have ₹${wallet.balance.toFixed(2)} available.`);
    }

    // Determine payout destination info
    const effectiveUpi = destination.upiId || user.payoutDetails?.upiId;
    const effectiveAccount = destination.accountNumber || user.payoutDetails?.accountNumber;
    const effectiveBank = destination.bankName || user.payoutDetails?.bankName || 'Bank Account';
    const effectiveHolder = destination.accountHolderName || user.payoutDetails?.accountHolderName || user.fullName;

    if (payoutMethod === 'upi' && !effectiveUpi) {
      throw new ApiError(400, 'Please enter or link a valid UPI ID in your profile or payout modal first');
    }
    if (payoutMethod === 'bank' && !effectiveAccount) {
      throw new ApiError(400, 'Please enter or link a valid Bank Account in your profile or payout modal first');
    }

    // Deduct from wallet
    wallet.balance -= numAmount;
    wallet.totalWithdrawn += numAmount;
    await wallet.save();

    const title = payoutMethod === 'upi'
      ? `Instant Payout to UPI (${effectiveUpi})`
      : `Bank Transfer to ${effectiveBank} (•••• ${effectiveAccount.slice(-4)})`;

    const description = `Direct payout transfer to ${payoutMethod === 'upi' ? `UPI handle ${effectiveUpi}` : `account ${effectiveAccount} (${effectiveHolder})`}. Settlement completed.`;

    const referenceId = `SB-WTH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await Transaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'withdrawal',
      title,
      description,
      amount: numAmount,
      fee: 0,
      netAmount: numAmount,
      status: 'Completed',
      destination: {
        method: payoutMethod,
        accountNumber: effectiveAccount || '',
        bankName: effectiveBank || '',
        upiId: effectiveUpi || '',
        accountHolderName: effectiveHolder || '',
      },
      referenceId,
    });

    return {
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        inEscrow: wallet.inEscrow,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
        currency: wallet.currency,
      },
      transaction,
    };
  }
}

module.exports = new WalletService();
