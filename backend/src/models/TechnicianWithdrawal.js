const mongoose = require('mongoose');

const technicianWithdrawalSchema = new mongoose.Schema({
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amountCents: { type: Number, min: 1 },
  currency: { type: String, default: 'USD', enum: ['USD'] },
  requestKey: String,
  encryptedBankSnapshot: { type: String, select: false },
  bankSnapshot: { accountHolder: String, bankName: String, accountType: String, last4: String, version: Number },
  payout: {
    provider: String, programToken: String, userToken: String, bankToken: String,
    paymentToken: String, providerStatus: String,
    state: { type: String, enum: ['queued', 'working', 'unknown', 'submitted', 'attention', 'completed'] },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: Date, leaseUntil: Date, leaseOwner: String,
    lastError: String, attemptedAt: Date, reconciledAt: Date
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: Date,
  sentAt: Date,
  paidAt: Date,
  transferReference: { type: String, maxlength: 200 },
  rejectionReason: String,
  failureReason: String,
  auditHistory: [{ action: String, actor: mongoose.Schema.Types.ObjectId, at: Date, note: String }],
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'sent', 'paid', 'rejected', 'cancelled', 'failed'],
    default: 'pending',
  },
  method: {
    type: String,
    enum: ['bank-transfer', 'upi', 'wallet'],
    default: 'bank-transfer',
  },
  details: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
});

technicianWithdrawalSchema.index({ technician: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });
technicianWithdrawalSchema.index({ 'payout.nextAttemptAt': 1, 'payout.state': 1 });
technicianWithdrawalSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('TechnicianWithdrawal', technicianWithdrawalSchema);
