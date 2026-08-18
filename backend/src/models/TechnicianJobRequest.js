const mongoose = require('mongoose');

const technicianJobRequestSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TechnicianJob',
    required: true,
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  note: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'counter-offer'],
    default: 'pending',
  },
  adminMessage: {
    type: String,
    default: '',
    trim: true,
  },
  counterOfferFrom: {
    type: String,
    enum: ['admin', 'technician', ''],
    default: '',
  },
  counterOffer: {
    type: Number,
    default: 0,
    min: 0,
  },
  conversation: [{
    sender: {
      type: String,
      enum: ['admin', 'technician', 'system'],
      default: 'system',
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    counterOffer: {
      type: Number,
      default: 0,
      min: 0,
    },
    counterOfferFrom: {
      type: String,
      enum: ['admin', 'technician', ''],
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  completedAt: {
    type: Date,
    default: null,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'pending'],
    default: 'unpaid',
  },
  amountEarned: {
    type: Number,
    default: 0,
    min: 0,
  },

  // ── Additional Charges & Invoice tracking ─────────────────────────────
  chargesStatus: {
    // 'none'      — no charges submitted yet
    // 'pending'   — technician has submitted charges, awaiting admin review
    // 'reviewing' — admin is reviewing (some accepted/rejected/countered)
    // 'agreed'    — all charges resolved (accepted or rejected), ready to invoice
    // 'invoiced'  — final invoice generated
    type: String,
    enum: ['none', 'pending', 'reviewing', 'agreed', 'invoiced'],
    default: 'none',
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobInvoice',
    default: null,
  },
  // Cached agreed totals (populated when invoice is generated)
  agreedFixedCharge: {
    type: Number,
    default: 0,
    min: 0,
  },
  agreedAdditionalTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  agreedTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TechnicianJobRequest', technicianJobRequestSchema);
