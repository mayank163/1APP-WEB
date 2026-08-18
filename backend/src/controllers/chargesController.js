/**
 * chargesController.js
 *
 * Handles the full Additional-Charges + Invoice flow:
 *
 * TECHNICIAN routes (tasks #4):
 *   POST   /api/technician/requests/:requestId/charges          → submitCharges
 *   PATCH  /api/technician/charges/:chargeId/respond            → respondToCounter
 *   GET    /api/technician/requests/:requestId/charges          → getMyCharges
 *   GET    /api/technician/requests/:requestId/invoice          → getTechnicianInvoice
 *
 * ADMIN routes (tasks #5 + #6):
 *   GET    /api/admin/technician-requests/:requestId/charges    → getJobCharges
 *   PATCH  /api/admin/charges/:chargeId/review                  → reviewCharge
 *   POST   /api/admin/technician-requests/:requestId/invoice    → generateInvoice
 *   GET    /api/admin/technician-requests/:requestId/invoice    → getInvoice
 *   PATCH  /api/admin/technician-requests/:requestId/invoice/pay → markInvoicePaid
 */

const AdditionalCharge    = require('../models/AdditionalCharge');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const TechnicianJob        = require('../models/TechnicianJob');
const JobInvoice           = require('../models/JobInvoice');
const User                 = require('../models/User');

const { getIO } = require('../utils/socketInstance');

// ── Helper: safely emit to admin room ─────────────────────────────────────────
const emitToAdmin = (event, payload) => {
  try {
    getIO().to('admin').emit(event, payload);
    console.log(`[Socket] emitToAdmin → room="admin" event="${event}"`);
  } catch (e) {
    console.warn(`[Socket] emitToAdmin failed for event "${event}":`, e.message);
  }
};

// ── Helper: emit to a request-scoped room ─────────────────────────────────────
const emitToRequest = (requestId, event, payload) => {
  try {
    getIO().to(`request:${requestId}`).emit(event, payload);
    console.log(`[Socket] emitToRequest → room="request:${requestId}" event="${event}"`);
  } catch (e) {
    console.warn(`[Socket] emitToRequest failed for event "${event}":`, e.message);
  }
};

// ── Helper: recompute chargesStatus on a request after any charge changes ─────
const syncChargesStatus = async (requestId) => {
  const charges = await AdditionalCharge.find({ request: requestId });
  if (!charges.length) return 'none';

  const hasPending   = charges.some((c) => c.status === 'pending');
  const hasCountered = charges.some((c) => c.status === 'countered');
  const allResolved  = charges.every((c) => ['accepted', 'rejected'].includes(c.status));

  let newStatus = 'reviewing';
  if (hasPending || hasCountered) newStatus = 'pending';
  if (allResolved) newStatus = 'agreed';

  await TechnicianJobRequest.findByIdAndUpdate(requestId, { chargesStatus: newStatus });
  return newStatus;
};

// =============================================================================
// TECHNICIAN — Submit additional charges
// POST /api/technician/requests/:requestId/charges
// Body: { charges: [{ label, description, amount }] }
// =============================================================================
exports.submitCharges = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const charges = req.body?.charges;

    if (!Array.isArray(charges) || charges.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one charge in body: { "charges": [...] }' });
    }

    const request = await TechnicianJobRequest.findById(requestId).populate('job');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only the technician who owns this request can submit charges
    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    // Allow adding charges while request is pending OR accepted (not after invoiced/rejected)
    if (['rejected', 'invoiced'].includes(request.status) || request.chargesStatus === 'invoiced') {
      return res.status(400).json({ success: false, message: 'Cannot add charges — request is already resolved' });
    }

    // Validate each charge
    const validLabels = ['Gas', 'Toll', 'Travel', 'Spare Parts', 'Extra Labor', 'Other'];
    const created = [];

    for (const c of charges) {
      if (!c.label || !c.label.trim()) {
        return res.status(400).json({ success: false, message: 'Each charge must have a label' });
      }
      if (!c.amount || Number(c.amount) <= 0) {
        return res.status(400).json({ success: false, message: `Amount for "${c.label}" must be > 0` });
      }

      const charge = await AdditionalCharge.create({
        job:             request.job._id || request.job,
        request:         requestId,
        technician:      req.user._id,
        label:           c.label.trim(),
        description:     c.description ? c.description.trim() : '',
        requestedAmount: Number(c.amount),
        status:          'pending',
        submittedAt:     new Date(),
      });
      created.push(charge);
    }

    // Update request chargesStatus
    await TechnicianJobRequest.findByIdAndUpdate(requestId, { chargesStatus: 'pending' });

    // Notify admin in real-time
    emitToAdmin('charges:submitted', { requestId, count: created.length });
    emitToRequest(requestId, 'charges:submitted', { requestId, charges: created });

    return res.status(201).json({
      success: true,
      message: `${created.length} charge(s) submitted for admin review`,
      data: { charges: created },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// TECHNICIAN — Respond to admin counter-offer on a single charge
// PATCH /api/technician/charges/:chargeId/respond
// Body: { action: 'accept' | 'reject', note? }
// =============================================================================
exports.respondToCounter = async (req, res, next) => {
  try {
    const { chargeId }     = req.params;
    const action           = req.body?.action;
    const note             = req.body?.note;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "accept" or "reject"' });
    }

    const charge = await AdditionalCharge.findById(chargeId);
    if (!charge) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }

    if (charge.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    if (charge.status !== 'countered') {
      return res.status(400).json({
        success: false,
        message: 'This charge has no pending counter-offer to respond to',
      });
    }

    const now = new Date();
    charge.technicianResponseNote = note ? note.trim() : '';
    charge.resolvedAt = now;

    if (action === 'accept') {
      charge.status       = 'accepted';
      charge.agreedAmount = charge.adminCounterAmount;
    } else {
      charge.status       = 'rejected';
      charge.agreedAmount = null;
    }

    await charge.save();

    // Re-sync parent request
    const newStatus = await syncChargesStatus(charge.request.toString());

    emitToAdmin('charge:responded', { chargeId, action, requestId: charge.request });
    emitToRequest(charge.request.toString(), 'charge:responded', { chargeId, action });

    return res.status(200).json({
      success: true,
      message: action === 'accept' ? 'Counter-offer accepted' : 'Counter-offer rejected',
      data: { charge, requestChargesStatus: newStatus },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// TECHNICIAN — Get all charges for a request (with admin review status)
// GET /api/technician/requests/:requestId/charges
// =============================================================================
exports.getMyCharges = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId)
      .populate('job', 'title location budget category')
      .populate('invoice');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    const charges = await AdditionalCharge.find({ request: requestId }).sort('createdAt');

    // Build a human-readable summary for each charge
    const chargesSummary = charges.map((c) => {
      let adminAction = null;
      let techAction  = null;
      let agreedPrice = null;

      if (c.status === 'accepted') {
        adminAction = 'accepted';
        agreedPrice = c.agreedAmount;
      } else if (c.status === 'rejected') {
        adminAction = 'rejected';
      } else if (c.status === 'countered') {
        adminAction = 'counter_offered';
      } else {
        adminAction = 'pending_review';
      }

      if (c.technicianResponseNote) {
        techAction = c.technicianResponseNote;
      }

      return {
        _id:              c._id,
        label:            c.label,
        description:      c.description,
        requestedAmount:  c.requestedAmount,
        agreedAmount:     agreedPrice,
        status:           c.status,
        adminAction,
        // counter-offer details
        adminCounterAmount: c.adminCounterAmount || null,
        adminNote:          c.adminNote         || null,
        // your response to counter
        technicianResponseNote: c.technicianResponseNote || null,
        // timestamps
        submittedAt: c.submittedAt,
        reviewedAt:  c.reviewedAt,
        resolvedAt:  c.resolvedAt,
        // what to do next
        needsYourResponse: c.status === 'countered',
      };
    });

    // Counts
    const pending   = chargesSummary.filter((c) => c.status === 'pending').length;
    const accepted  = chargesSummary.filter((c) => c.status === 'accepted').length;
    const rejected  = chargesSummary.filter((c) => c.status === 'rejected').length;
    const countered = chargesSummary.filter((c) => c.status === 'countered').length;

    return res.status(200).json({
      success: true,
      data: {
        request: {
          _id:           request._id,
          status:        request.status,
          chargesStatus: request.chargesStatus,
          job:           request.job,
          note:          request.note,
          counterOffer:  request.counterOffer || null,
          adminMessage:  request.adminMessage || null,
          invoice:       request.invoice      || null,
        },
        charges: chargesSummary,
        summary: {
          total:    charges.length,
          pending,
          accepted,
          rejected,
          countered,
          needsYourResponse: countered,   // how many counters are waiting for tech response
          allResolved: (pending === 0 && countered === 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// TECHNICIAN — Get full status of a single request (charges + invoice + admin reply)
// GET /api/technician/requests/:requestId/status
// =============================================================================
exports.getMyRequestStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId)
      .populate('job', 'title location budget category status')
      .populate('invoice');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    const charges = await AdditionalCharge.find({ request: requestId }).sort('createdAt');

    // Separate charges by what needs action vs what is resolved
    const pendingAdminReview = charges.filter((c) => c.status === 'pending');
    const awaitingYourReply  = charges.filter((c) => c.status === 'countered');
    const accepted           = charges.filter((c) => c.status === 'accepted');
    const rejected           = charges.filter((c) => c.status === 'rejected');

    // Build next-action hint for the technician
    let nextAction = null;
    if (request.status === 'rejected') {
      nextAction = 'Your request was rejected by admin.';
    } else if (awaitingYourReply.length > 0) {
      nextAction = `Admin has sent counter-offers on ${awaitingYourReply.length} charge(s). Please respond to them.`;
    } else if (pendingAdminReview.length > 0) {
      nextAction = `${pendingAdminReview.length} charge(s) are waiting for admin review.`;
    } else if (request.chargesStatus === 'agreed' && !request.invoice) {
      nextAction = 'All charges agreed. Waiting for admin to generate the invoice.';
    } else if (request.chargesStatus === 'invoiced' && request.invoice?.status === 'finalised') {
      nextAction = 'Invoice is ready. Waiting for admin to process payment.';
    } else if (request.invoice?.status === 'paid') {
      nextAction = 'Payment done. Check your wallet.';
    } else if (request.status === 'pending') {
      nextAction = 'Request submitted. Waiting for admin review.';
    } else if (request.status === 'accepted') {
      nextAction = 'Request accepted. Job will be assigned soon.';
    }

    return res.status(200).json({
      success: true,
      data: {
        // Request overview
        request: {
          _id:              request._id,
          status:           request.status,
          chargesStatus:    request.chargesStatus,
          note:             request.note,
          adminMessage:     request.adminMessage || null,
          // If admin sent a counter on the fixed price
          fixedPriceCounter: request.counterOffer && request.counterOfferFrom === 'admin'
            ? { amount: request.counterOffer, note: request.adminMessage }
            : null,
          agreedFixedCharge:      request.agreedFixedCharge     || null,
          agreedAdditionalTotal:  request.agreedAdditionalTotal || null,
          agreedTotal:            request.agreedTotal           || null,
          createdAt:        request.createdAt,
        },
        job:     request.job,
        invoice: request.invoice || null,

        // Charges broken out by state so the UI knows exactly what to show
        charges: {
          pendingAdminReview: pendingAdminReview.map(fmt),
          awaitingYourReply:  awaitingYourReply.map(fmt),
          accepted:           accepted.map(fmt),
          rejected:           rejected.map(fmt),
          all:                charges.map(fmt),
        },

        summary: {
          totalCharges:         charges.length,
          pendingAdminReview:   pendingAdminReview.length,
          awaitingYourReply:    awaitingYourReply.length,
          accepted:             accepted.length,
          rejected:             rejected.length,
          allResolved:          pendingAdminReview.length === 0 && awaitingYourReply.length === 0,
        },

        nextAction,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Format helper used above ───────────────────────────────────────────────────
function fmt(c) {
  return {
    _id:                   c._id,
    label:                 c.label,
    description:           c.description,
    requestedAmount:       c.requestedAmount,
    adminCounterAmount:    c.adminCounterAmount || null,
    adminNote:             c.adminNote          || null,
    agreedAmount:          c.agreedAmount       || null,
    status:                c.status,
    needsYourResponse:     c.status === 'countered',
    technicianResponseNote: c.technicianResponseNote || null,
    submittedAt:           c.submittedAt,
    reviewedAt:            c.reviewedAt,
    resolvedAt:            c.resolvedAt,
  };
}
exports.getTechnicianInvoice = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId).populate('invoice');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    if (!request.invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not generated yet' });
    }

    return res.status(200).json({ success: true, data: { invoice: request.invoice } });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Get all charges for a request
// GET /api/admin/technician-requests/:requestId/charges
// =============================================================================
exports.getJobCharges = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId).populate('job invoice');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const charges = await AdditionalCharge.find({ request: requestId }).sort('createdAt');

    return res.status(200).json({
      success: true,
      data: { request, charges },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Review a single charge (accept / reject / counter)
// PATCH /api/admin/charges/:chargeId/review
// Body: { action: 'accept'|'reject'|'counter', counterAmount?, adminNote? }
// =============================================================================
exports.reviewCharge = async (req, res, next) => {
  try {
    const { chargeId }        = req.params;
    const action              = req.body?.action;
    const counterAmount       = req.body?.counterAmount;
    const adminNote           = req.body?.adminNote;

    if (!['accept', 'reject', 'counter'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be accept | reject | counter' });
    }

    const charge = await AdditionalCharge.findById(chargeId);
    if (!charge) return res.status(404).json({ success: false, message: 'Charge not found' });

    if (!['pending', 'countered'].includes(charge.status)) {
      return res.status(400).json({
        success: false,
        message: 'Charge is already resolved and cannot be reviewed again',
      });
    }

    const now       = new Date();
    charge.adminNote = adminNote ? adminNote.trim() : '';
    charge.reviewedAt = now;

    switch (action) {
      case 'accept':
        charge.status       = 'accepted';
        charge.agreedAmount = charge.requestedAmount;
        charge.resolvedAt   = now;
        break;

      case 'reject':
        charge.status     = 'rejected';
        charge.resolvedAt = now;
        break;

      case 'counter': {
        const amt = Number(counterAmount);
        if (!amt || amt <= 0) {
          return res.status(400).json({ success: false, message: 'Counter amount must be > 0' });
        }
        charge.status             = 'countered';
        charge.adminCounterAmount = amt;
        break;
      }

      default:
        break;
    }

    await charge.save();

    // Re-sync parent request chargesStatus
    const newChargesStatus = await syncChargesStatus(charge.request.toString());

    // Notify technician in real-time
    emitToRequest(charge.request.toString(), 'charge:reviewed', {
      chargeId,
      action,
      charge,
      requestChargesStatus: newChargesStatus,
    });
    emitToAdmin('charge:reviewed', { chargeId, action, requestId: charge.request });

    return res.status(200).json({
      success: true,
      message: `Charge ${action}ed`,
      data: { charge, requestChargesStatus: newChargesStatus },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Generate final invoice (once all charges are agreed / resolved)
// POST /api/admin/technician-requests/:requestId/invoice
// Body: { adminNotes? }
// =============================================================================
exports.generateInvoice = async (req, res, next) => {
  try {
    const { requestId }  = req.params;
    const adminNotes     = req.body?.adminNotes;

    const request = await TechnicianJobRequest.findById(requestId).populate('job');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (!['pending', 'accepted'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invoice can only be generated for a pending or accepted request',
      });
    }

    if (request.chargesStatus === 'invoiced') {
      // Return the existing invoice instead of duplicating
      const existing = await JobInvoice.findById(request.invoice);
      return res.status(200).json({ success: true, message: 'Invoice already exists', data: { invoice: existing } });
    }

    // Check all charges are resolved (no pending / countered)
    const charges = await AdditionalCharge.find({ request: requestId });
    const unresolved = charges.filter((c) => ['pending', 'countered'].includes(c.status));
    if (unresolved.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${unresolved.length} charge(s) still pending admin review — resolve them before generating invoice`,
      });
    }

    // Fixed charge = the agreed bid or the original job budget
    const job = request.job;
    const fixedCharge = request.counterOffer > 0 ? request.counterOffer : (job.budget || 0);

    // Build accepted charge line items
    const acceptedCharges = charges
      .filter((c) => c.status === 'accepted')
      .map((c) => ({
        chargeId:        c._id,
        label:           c.label,
        description:     c.description || '',
        requestedAmount: c.requestedAmount,
        agreedAmount:    c.agreedAmount,
      }));

    const subtotalAdditional = acceptedCharges.reduce((sum, c) => sum + c.agreedAmount, 0);
    const totalAmount        = fixedCharge + subtotalAdditional;

    const invoice = await JobInvoice.create({
      job:                job._id,
      request:            requestId,
      technician:         request.technician,
      fixedJobCharge:     fixedCharge,
      additionalCharges:  acceptedCharges,
      subtotalAdditional,
      totalAmount,
      status:             'finalised',
      adminNotes:         adminNotes || '',
      finalisedAt:        new Date(),
    });

    // Update request with invoice ref + agreed totals + chargesStatus = 'invoiced'
    request.invoice               = invoice._id;
    request.chargesStatus         = 'invoiced';
    request.agreedFixedCharge     = fixedCharge;
    request.agreedAdditionalTotal = subtotalAdditional;
    request.agreedTotal           = totalAmount;
    request.amountEarned          = totalAmount;
    request.paymentStatus         = 'pending';
    await request.save();

    // Update the TechnicianJob.finalPrice to the invoice total
    await TechnicianJob.findByIdAndUpdate(job._id, { finalPrice: totalAmount });

    // Notify
    emitToRequest(requestId, 'invoice:generated', { requestId, invoice });
    emitToAdmin('invoice:generated', { requestId, invoice });

    return res.status(201).json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} generated — total $${totalAmount}`,
      data: { invoice },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Get invoice for a request
// GET /api/admin/technician-requests/:requestId/invoice
// =============================================================================
exports.getInvoice = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (!request.invoice) {
      return res.status(404).json({ success: false, message: 'No invoice generated yet' });
    }

    const invoice = await JobInvoice.findById(request.invoice)
      .populate('job', 'title location category budget')
      .populate('technician', 'name phone email');

    return res.status(200).json({ success: true, data: { invoice } });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Mark invoice as paid and credit technician wallet
// PATCH /api/admin/technician-requests/:requestId/invoice/pay
// Body: { note? }
// =============================================================================
exports.markInvoicePaid = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const note          = req.body?.note;

    const request = await TechnicianJobRequest.findById(requestId).populate('job');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (!request.invoice) {
      return res.status(400).json({ success: false, message: 'No invoice found — generate invoice first' });
    }

    const invoice = await JobInvoice.findById(request.invoice);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoice already marked as paid' });
    }

    const amount = invoice.totalAmount;
    const now    = new Date();

    // Mark invoice paid
    invoice.status = 'paid';
    invoice.paidAt = now;
    await invoice.save();

    // Update request payment status
    request.paymentStatus = 'paid';
    request.amountEarned  = amount;
    request.completedAt   = now;
    await request.save();

    // Credit technician wallet
    const technician = await User.findById(request.technician);
    if (technician) {
      technician.totalEarnings = (technician.totalEarnings || 0) + amount;
      technician.totalJobsDone = (technician.totalJobsDone || 0) + 1;
      await technician.save();
    }

    // Update job status to completed + finalPrice
    const job = request.job;
    if (job) {
      await TechnicianJob.findByIdAndUpdate(job._id || job, {
        status:     'completed',
        finalPrice: amount,
        completedAt: now,
      });
    }

    const payNote = note || `Invoice ${invoice.invoiceNumber} paid. $${amount} credited to technician wallet.`;

    emitToRequest(requestId, 'invoice:paid', { requestId, amount, invoiceNumber: invoice.invoiceNumber });
    emitToAdmin('invoice:paid', { requestId, amount, invoiceNumber: invoice.invoiceNumber });

    return res.status(200).json({
      success: true,
      message: payNote,
      data: { invoice, amountCredited: amount },
    });
  } catch (err) {
    next(err);
  }
};
