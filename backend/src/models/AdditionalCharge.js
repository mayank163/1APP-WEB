const mongoose = require('mongoose');

/**
 * AdditionalCharge — one charge line item proposed by a technician mid-job.
 *
 * Full negotiation flow (can repeat as many rounds as needed):
 *
 *   1. Technician submits        → status: 'pending'
 *   2. Admin accepts             → status: 'accepted'   (agreedAmount = requestedAmount)
 *      Admin rejects             → status: 'rejected'
 *      Admin counter-offers      → status: 'countered'  (adminCounterAmount set,  turn = 'technician')
 *   3. Tech accepts admin offer  → status: 'accepted'   (agreedAmount = adminCounterAmount)
 *      Tech re-counters          → status: 'countered'  (technicianCounterAmount set, turn = 'admin')
 *   4. Admin accepts tech offer  → status: 'accepted'   (agreedAmount = technicianCounterAmount)
 *      Admin re-counters         → status: 'countered'  (adminCounterAmount set again, turn = 'technician')
 *   … repeat until one side accepts or rejects.
 *
 * Every action (submit / counter / accept / reject) is appended to counterHistory.
 */

const counterHistoryEntrySchema = new mongoose.Schema(
  {
    round:      { type: Number, required: true },           // 1-based negotiation round
    actor:      { type: String, enum: ['technician', 'admin'], required: true },
    action:     { type: String, enum: ['submit', 'counter', 'accept', 'reject'], required: true },
    amount:     { type: Number, default: null },            // null for reject
    note:       { type: String, default: '', trim: true },
    createdAt:  { type: Date,   default: Date.now },
  },
  { _id: false }
);

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

    // ── Negotiation state ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered'],
      default: 'pending',
    },
    // Whose turn it is to respond (only meaningful when status === 'countered')
    pendingWith: {
      type: String,
      enum: ['technician', 'admin', null],
      default: null,
    },

    // Latest active counter values (cleared once the side re-counters)
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
    technicianCounterAmount: {
      type: Number,
      default: null,
      min: 0,
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

    // ── Full negotiation history ───────────────────────────────────────────
    // Every submit / counter / accept / reject is appended here.
    counterHistory: {
      type: [counterHistoryEntrySchema],
      default: [],
    },

    // ── Timestamps for each stage ─────────────────────────────────────────
    submittedAt: { type: Date, default: Date.now },
    reviewedAt:  { type: Date, default: null },
    resolvedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdditionalCharge', additionalChargeSchema);
