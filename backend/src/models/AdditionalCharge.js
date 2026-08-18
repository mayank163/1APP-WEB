const mongoose = require('mongoose');

/**
 * AdditionalCharge — one charge line item proposed by a technician mid-job.
 *
 * Flow per charge:
 *   technician submits  → status: 'pending'
 *   admin accepts       → status: 'accepted'    (agreedAmount = requestedAmount)
 *   admin rejects       → status: 'rejected'
 *   admin counters      → status: 'countered'   (adminCounterAmount set)
 *   technician accepts counter → status: 'accepted' (agreedAmount = adminCounterAmount)
 *   technician rejects counter → status: 'rejected'
 */
const additionalChargeSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TechnicianJob',
      required: true,
      index: true,
    },
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TechnicianJobRequest',
      required: true,
      index: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Charge details ─────────────────────────────────────────────────────
    label: {
      type: String,
      required: [true, 'Charge label is required'],
      trim: true,
      // e.g. "Gas", "Toll", "Travel", "Spare Parts", "Extra Labor", "Other"
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    requestedAmount: {
      type: Number,
      required: [true, 'Requested amount is required'],
      min: 0,
    },

    // ── Negotiation ────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered'],
      default: 'pending',
    },
    adminCounterAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
    technicianResponseNote: {
      type: String,
      default: '',
      trim: true,
    },

    // ── Resolved value (set when status becomes 'accepted') ────────────────
    agreedAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // ── Timestamps for each stage ─────────────────────────────────────────
    submittedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date, default: null },
    resolvedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdditionalCharge', additionalChargeSchema);
