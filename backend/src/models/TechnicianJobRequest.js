const mongoose = require('mongoose');

// ── One entry in the request conversation ─────────────────────────────────────
// type field drives what extra fields are present:
//   'message'           → plain text from admin/technician
//   'charge_submitted'  → technician submitted one or more additional charges
//   'charge_reviewed'   → admin accepted / rejected / countered a charge
//   'charge_responded'  → technician accepted or re-countered admin's counter
//   'fixed_charge'      → technician proposed a fixed job price
//   'final_amount'      → system entry summarising the agreed final job total
//   'invoice_generated' → system entry when invoice is created
const conversationEntrySchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ['admin', 'technician', 'system'],
      default: 'system',
    },
    // Discriminator for the UI — what kind of event is this?
    type: {
      type: String,
      enum: [
        'message',
        'charge_submitted',
        'charge_reviewed',      // legacy (single-charge entry, kept for old data)
        'charge_responded',     // legacy (single-charge entry, kept for old data)
        'charge_status_update', // NEW: batched snapshot of ALL charges after any action
        'fixed_charge',
        'final_amount',
        'invoice_generated',
      ],
      default: 'message',
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },

    // ── Fixed price bid fields (type = 'fixed_charge') ─────────────────
    fixedCharge: {
      type: Number,
      default: null,
    },
    // Legacy: kept for backwards compat with older conversation entries
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

    // ── Charge event fields (type = 'charge_submitted' | 'charge_reviewed' | 'charge_responded') ──
    // Reference to the AdditionalCharge document this event is about
    chargeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdditionalCharge',
      default: null,
    },
    // For 'charge_submitted' — snapshot of all charges submitted in this batch
    // For 'charge_status_update' — full snapshot of ALL charges with negotiation state
    charges: [
      {
        chargeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'AdditionalCharge', default: null },
        label:       { type: String, default: '' },
        description: { type: String, default: '' },
        amount:      { type: Number, default: 0 },          // requestedAmount (charge_submitted)
        requestedAmount: { type: Number, default: null },   // requestedAmount (charge_status_update)

        // ── Negotiation state (charge_status_update only) ─────────────────
        status:      { type: String, default: '' },         // pending | accepted | rejected | countered
        statusLabel: { type: String, default: '' },         // human-readable label for the UI
        lastActionBy:{ type: String, default: null },        // 'admin' | 'technician' | null — who last acted
        pendingWith: { type: String, default: null },        // 'admin' | 'technician' | null
        activeOffer: { type: Number, default: null },        // amount currently on the table

        // ── Resolved & counter values ─────────────────────────────────────
        agreedAmount:            { type: Number, default: null },
        adminCounterAmount:      { type: Number, default: null },
        technicianCounterAmount: { type: Number, default: null },
        adminNote:               { type: String, default: '' },
        technicianNote:          { type: String, default: '' },

        // ── Full round-by-round history ───────────────────────────────────
        counterHistory: { type: Array, default: [] },
      },
    ],
    // For 'charge_reviewed' / 'charge_responded'
    chargeLabel:  { type: String, default: '' },
    action:       { type: String, default: '' }, // 'accept' | 'reject' | 'counter'
    amount:       { type: Number, default: null }, // the offer/counter/agreed amount
    note:         { type: String, default: '' },   // optional note from sender

    // ── Final amount summary (type = 'final_amount' | 'invoice_generated') ──
    fixedJobCharge:        { type: Number, default: null },
    additionalChargesTotal:{ type: Number, default: null },
    finalAmount:           { type: Number, default: null },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const technicianJobRequestSchema = new mongoose.Schema(
  {
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

    // ── Full conversation / charge negotiation log ─────────────────────
    conversation: [conversationEntrySchema],

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

    // ── Additional Charges & Invoice tracking ──────────────────────────
    chargesStatus: {
      // 'none'      — no additional charges submitted yet
      // 'pending'   — technician submitted charges, awaiting admin review
      // 'reviewing' — admin is reviewing (some accepted/rejected/countered)
      // 'agreed'    — all charges resolved, ready to invoice
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

    // ── Cached agreed totals (set when invoice is generated or job accepted) ──
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

    // ── Final calculated job amount (set as soon as both sides accept) ──
    // Calculated as: agreedFixedCharge + agreedAdditionalTotal
    finalJobAmount: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TechnicianJobRequest', technicianJobRequestSchema);
