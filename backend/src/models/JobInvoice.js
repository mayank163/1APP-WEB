const mongoose = require('mongoose');

/**
 * JobInvoice — the final agreed invoice generated once all additional charges
 * are resolved (all accepted or rejected) and the job is ready to be assigned.
 *
 * Structure:
 *   fixedJobCharge      — the original job budget / agreed bid amount
 *   additionalCharges   — snapshot of each accepted AdditionalCharge line item
 *   totalAmount         — fixedJobCharge + sum of accepted additionalCharges
 *   status              — draft → finalised → paid
 */
const jobInvoiceSchema = new mongoose.Schema(
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

    invoiceNumber: {
      type: String,
      unique: true,
    },

    // ── Fixed base charge ─────────────────────────────────────────────────
    fixedJobCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    fixedJobLabel: {
      type: String,
      default: 'Fixed Job Charge',
    },

    // ── Accepted additional charge line items (snapshot) ──────────────────
    additionalCharges: [
      {
        chargeId:       { type: mongoose.Schema.Types.ObjectId, ref: 'AdditionalCharge' },
        label:          { type: String, required: true },
        description:    { type: String, default: '' },
        requestedAmount:{ type: Number, required: true, min: 0 },
        agreedAmount:   { type: Number, required: true, min: 0 },
      },
    ],

    // ── Totals ────────────────────────────────────────────────────────────
    subtotalAdditional: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'finalised', 'paid'],
      default: 'draft',
    },

    // ── Notes ─────────────────────────────────────────────────────────────
    adminNotes: {
      type: String,
      default: '',
      trim: true,
    },

    finalisedAt: { type: Date, default: null },
    paidAt:      { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto-generate a human-readable invoice number before save
jobInvoiceSchema.pre('save', async function () {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('JobInvoice').countDocuments();
    const pad   = String(count + 1).padStart(5, '0');
    this.invoiceNumber = `INV-JOB-${pad}`;
  }
});

module.exports = mongoose.model('JobInvoice', jobInvoiceSchema);
