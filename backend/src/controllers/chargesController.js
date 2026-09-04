/**
 * chargesController.js
 *
 * Handles the full Additional-Charges + Invoice flow.
 *
 * Every action (submit / admin-review / tech-respond / invoice-generate) is
 * mirrored as a structured conversation entry inside TechnicianJobRequest so
 * the entire negotiation can be rendered as a timeline by the front-end.
 *
 * TECHNICIAN routes:
 *   POST   /api/technician/requests/:requestId/charges       → submitCharges
 *   PATCH  /api/technician/charges/:chargeId/respond         → respondToCounter
 *   GET    /api/technician/requests/:requestId/charges       → getMyCharges
 *   GET    /api/technician/requests/:requestId/status        → getMyRequestStatus
 *   GET    /api/technician/requests/:requestId/invoice       → getTechnicianInvoice
 *   GET    /api/technician/requests/:requestId/conversation  → getConversation (technicianRoutes)
 *
 * ADMIN routes:
 *   GET    /api/admin/technician-requests/:requestId/charges          → getJobCharges
 *   PATCH  /api/admin/charges/:chargeId/review                        → reviewCharge
 *   POST   /api/admin/technician-requests/:requestId/invoice          → generateInvoice
 *   GET    /api/admin/technician-requests/:requestId/invoice          → getInvoice
 *   PATCH  /api/admin/technician-requests/:requestId/invoice/pay      → markInvoicePaid
 */

const AdditionalCharge     = require('../models/AdditionalCharge');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const TechnicianJob        = require('../models/TechnicianJob');
const JobInvoice           = require('../models/JobInvoice');
const User                 = require('../models/User');

const { getIO } = require('../utils/socketInstance');

// ── Helpers: safe socket emitters ─────────────────────────────────────────────
const emitToAdmin = (event, payload) => {
  try {
    getIO().to('admin').emit(event, payload);
    console.log(`[Socket] emitToAdmin → room="admin" event="${event}"`);
  } catch (e) {
    console.warn(`[Socket] emitToAdmin failed for event "${event}":`, e.message);
  }
};

const emitToRequest = (requestId, event, payload) => {
  try {
    getIO().to(`request:${requestId}`).emit(event, payload);
    console.log(`[Socket] emitToRequest → room="request:${requestId}" event="${event}"`);
  } catch (e) {
    console.warn(`[Socket] emitToRequest failed for event "${event}":`, e.message);
  }
};

// ── Helper: recompute chargesStatus on a request after any charge change ──────
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

// ── Helper: push (or replace) a single batched charge_status_update entry ─────
//
// Every time admin or technician acts on a charge we:
//   1. Pull ALL existing 'charge_status_update' entries from the conversation.
//   2. Push ONE fresh entry that lists every charge with its current status.
//
// This keeps the conversation clean — the latest snapshot always reflects
// the full picture, and the UI never shows stale per-charge rows.
const pushChargeStatusUpdate = async (requestId, actor, now) => {
  const charges = await AdditionalCharge.find({ request: requestId }).sort('submittedAt');

  // Build per-charge snapshot — includes full negotiation state so the
  // front-end can render the complete back-and-forth for each charge.
  const chargeSnapshots = charges.map((c) => {
    // Who performed the last action on this charge?
    // counterHistory is ordered by round, so the last entry is the most recent actor.
    const lastHistoryEntry = c.counterHistory?.length
      ? c.counterHistory[c.counterHistory.length - 1]
      : null;
    const lastActionBy = lastHistoryEntry?.actor || null;  // 'admin' | 'technician' | null

    // Determine the active offer amount (the number currently on the table)
    let activeOffer = null;
    if (c.status === 'countered') {
      activeOffer = c.pendingWith === 'technician'
        ? c.adminCounterAmount          // admin countered, waiting for tech
        : c.technicianCounterAmount;    // tech re-countered, waiting for admin
    } else if (c.status === 'accepted') {
      activeOffer = c.agreedAmount;
    }

    // statusLabel: human-readable string the UI can display directly.
    // For accepted/rejected we include WHO did the action using lastActionBy.
    let statusLabel;
    switch (c.status) {
      case 'accepted':
        statusLabel = `Accepted by ${lastActionBy || 'admin'} at ₹${c.agreedAmount}`;
        break;
      case 'rejected':
        statusLabel = `Rejected by ${lastActionBy || 'admin'}`;
        break;
      case 'countered':
        if (c.pendingWith === 'technician')
          statusLabel = `Counter-offer by admin: ₹${c.adminCounterAmount} — awaiting technician response`;
        else
          statusLabel = `Counter-offer by technician: ₹${c.technicianCounterAmount} — awaiting admin response`;
        break;
      default:
        statusLabel = 'Pending admin review';
    }

    return {
      chargeId:            c._id,
      label:               c.label,
      description:         c.description  || '',
      requestedAmount:     c.requestedAmount,
      // ── Who last acted on this charge ──────────────────────────────────
      lastActionBy,                            // 'admin' | 'technician' | null
      // ── Current negotiation state ──────────────────────────────────────
      status:              c.status,           // 'pending' | 'accepted' | 'rejected' | 'countered'
      statusLabel,                             // human-readable label for display
      pendingWith:         c.pendingWith || null, // who needs to respond next
      activeOffer,                             // the amount currently on the table
      // ── Resolved value ─────────────────────────────────────────────────
      agreedAmount:        c.agreedAmount     || null,
      // ── Latest counter amounts ─────────────────────────────────────────
      adminCounterAmount:  c.adminCounterAmount       || null,
      technicianCounterAmount: c.technicianCounterAmount || null,
      // ── Notes from both sides ──────────────────────────────────────────
      adminNote:           c.adminNote               || '',
      technicianNote:      c.technicianResponseNote  || '',
      // ── Full round-by-round negotiation history ────────────────────────
      // Each entry: { round, actor, action, amount, note, createdAt }
      counterHistory:      c.counterHistory  || [],
    };
  });

  // Build a human-readable summary text using the per-charge statusLabel
  const lines = chargeSnapshots.map(
    (c) => `• ${c.label} (₹${c.requestedAmount}): ${c.statusLabel}`
  );
  const message = `Charges update (triggered by ${actor}):\n${lines.join('\n')}`;

  // Remove any previous batched entry, then push the fresh one.
  // sender is always 'system' because one entry covers actions from both sides —
  // use per-charge `lastActionBy` to know who acted on each individual charge.
  await TechnicianJobRequest.findByIdAndUpdate(requestId, {
    $pull: { conversation: { type: 'charge_status_update' } },
  });

  await TechnicianJobRequest.findByIdAndUpdate(requestId, {
    $push: {
      conversation: {
        sender:       'system',
        type:         'charge_status_update',
        message,
        charges:      chargeSnapshots,
        createdAt:    now,
      },
    },
  });
};

// ── Helper: recalculate and store final job amount on a request ───────────────
// Called whenever all charges are resolved AND a fixed charge is known.
// Returns the calculated total (or null if not all resolved yet).
const recalculateFinalAmount = async (request) => {
  const charges = await AdditionalCharge.find({ request: request._id });

  // If there are unresolved charges, don't finalise yet
  const hasUnresolved = charges.some((c) => ['pending', 'countered'].includes(c.status));
  if (hasUnresolved) return null;

  // Fixed charge = agreed counter offer OR original job budget
  const job = request.job
    ? (request.job._id ? request.job : await TechnicianJob.findById(request.job))
    : await TechnicianJob.findById(request.job);
  const jobDoc = request.job?._id ? request.job : job;

  const fixedCharge        = request.counterOffer > 0 ? request.counterOffer : (jobDoc?.budget || 0);
  const acceptedCharges    = charges.filter((c) => c.status === 'accepted');
  const additionalTotal    = acceptedCharges.reduce((sum, c) => sum + (c.agreedAmount || 0), 0);
  const total              = fixedCharge + additionalTotal;

  request.agreedFixedCharge     = fixedCharge;
  request.agreedAdditionalTotal = additionalTotal;
  request.agreedTotal           = total;
  request.finalJobAmount        = total;

  return { fixedCharge, additionalTotal, total, acceptedCharges };
};

// =============================================================================
// TECHNICIAN — Submit additional charges
// POST /api/technician/requests/:requestId/charges
// Body: { charges: [{ label, description, amount }] }
// =============================================================================
exports.submitCharges = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const chargesInput  = req.body?.charges;

    if (!Array.isArray(chargesInput) || chargesInput.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one charge in body: { "charges": [...] }',
      });
    }

    const request = await TechnicianJobRequest.findById(requestId).populate('job');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only the owning technician can submit charges
    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    // Validate each charge
    for (const c of chargesInput) {
      if (!c.label?.trim()) {
        return res.status(400).json({ success: false, message: 'Each charge must have a label' });
      }
      if (!c.amount || Number(c.amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: `Amount for "${c.label}" must be > 0`,
        });
      }
    }

    const now     = new Date();
    const created = [];

    for (const c of chargesInput) {
      const amt    = Number(c.amount);
      const charge = await AdditionalCharge.create({
        job:             request.job._id || request.job,
        request:         requestId,
        technician:      req.user._id,
        label:           c.label.trim(),
        description:     c.description ? c.description.trim() : '',
        requestedAmount: amt,
        status:          'pending',
        pendingWith:     'admin',
        submittedAt:     now,
        counterHistory: [
          {
            round:     1,
            actor:     'technician',
            action:    'submit',
            amount:    amt,
            note:      c.description ? c.description.trim() : '',
            createdAt: now,
          },
        ],
      });
      created.push(charge);
    }

    // ── Push a single 'charge_submitted' conversation entry ───────────────────
    // Contains a snapshot of every charge submitted in this batch so the
    // conversation timeline shows them as one grouped event.
    const chargeSnapshots = created.map((ch) => ({
      chargeId:    ch._id,
      label:       ch.label,
      description: ch.description,
      amount:      ch.requestedAmount,
    }));

    const convEntry = {
      sender:  'technician',
      type:    'charge_submitted',
      message: `Submitted ${created.length} additional charge${created.length > 1 ? 's' : ''} for admin review.`,
      charges: chargeSnapshots,
      createdAt: now,
    };

    await TechnicianJobRequest.findByIdAndUpdate(requestId, {
      chargesStatus: 'pending',
      $push: { conversation: convEntry },
    });

    // Notify in real-time
    emitToAdmin('charges:submitted', { requestId, count: created.length, charges: created });
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
// Body: { action: 'accept' | 'counter', amount? (required for counter), note? }
// =============================================================================
exports.respondToCounter = async (req, res, next) => {
  try {
    const { chargeId } = req.params;
    const action       = req.body?.action;
    const note         = req.body?.note;
    const amount       = req.body?.amount;

    if (!['accept', 'counter'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be "accept" or "counter"',
      });
    }

    const charge = await AdditionalCharge.findById(chargeId);
    if (!charge) return res.status(404).json({ success: false, message: 'Charge not found' });

    if (charge.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    // Must be countered AND it must be technician's turn
    if (charge.status !== 'countered' || charge.pendingWith !== 'technician') {
      return res.status(400).json({
        success: false,
        message: 'This charge has no pending counter-offer for you to respond to',
      });
    }

    const now       = new Date();
    const cleanNote = note ? note.trim() : '';
    const adminOffer = charge.adminCounterAmount;
    const nextRound  = (charge.counterHistory?.length || 0) + 1;

    if (action === 'accept') {
      // Technician accepts admin's latest counter-offer
      charge.status               = 'accepted';
      charge.pendingWith          = null;
      charge.agreedAmount         = adminOffer;
      charge.resolvedAt           = now;
      charge.technicianResponseNote = cleanNote;

      charge.counterHistory.push({
        round:     nextRound,
        actor:     'technician',
        action:    'accept',
        amount:    adminOffer,
        note:      cleanNote,
        createdAt: now,
      });
    } else {
      // Technician re-counters with a new amount
      if (amount === undefined || amount === null || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'A valid counter-offer amount is required',
        });
      }

      const techAmt = Number(amount);

      charge.status                  = 'countered';
      charge.pendingWith             = 'admin';
      charge.technicianCounterAmount = techAmt;
      charge.technicianResponseNote  = cleanNote;
      charge.adminCounterAmount      = null;
      charge.adminNote               = '';
      charge.resolvedAt              = null;
      charge.reviewedAt              = null;

      charge.counterHistory.push({
        round:     nextRound,
        actor:     'technician',
        action:    'counter',
        amount:    techAmt,
        note:      cleanNote,
        createdAt: now,
      });
    }

    await charge.save();

    const newChargesStatus = await syncChargesStatus(charge.request.toString());

    // ── Replace previous batched charge entry with a fresh snapshot ───────────
    await pushChargeStatusUpdate(charge.request.toString(), 'technician', now);

    // ── If all charges resolved, compute final job amount ─────────────────────
    const request = await TechnicianJobRequest.findById(charge.request).populate('job');
    let finalAmountData = null;
    if (newChargesStatus === 'agreed' && request) {
      finalAmountData = await recalculateFinalAmount(request);
      if (finalAmountData) {
        const finalEntry = {
          sender:                 'system',
          type:                   'final_amount',
          message:                `All charges agreed. Final job amount: ₹${finalAmountData.total} (Fixed: ₹${finalAmountData.fixedCharge} + Additional: ₹${finalAmountData.additionalTotal}).`,
          fixedJobCharge:         finalAmountData.fixedCharge,
          additionalChargesTotal: finalAmountData.additionalTotal,
          finalAmount:            finalAmountData.total,
          createdAt:              now,
        };
        await TechnicianJobRequest.findByIdAndUpdate(charge.request, {
          $push: { conversation: finalEntry },
        });
        await request.save();

        const jobId = request.job?._id || request.job;
        if (jobId) await TechnicianJob.findByIdAndUpdate(jobId, { finalPrice: finalAmountData.total });

        emitToRequest(charge.request.toString(), 'final_amount:calculated', { requestId: charge.request, ...finalAmountData });
        emitToAdmin('final_amount:calculated', { requestId: charge.request, ...finalAmountData });
      }
    }

    emitToAdmin('charge:responded', {
      chargeId,
      action,
      requestId:            charge.request,
      amount:               action === 'counter' ? charge.technicianCounterAmount : charge.agreedAmount,
      requestChargesStatus: newChargesStatus,
    });
    emitToRequest(charge.request.toString(), 'charge:responded', {
      chargeId,
      action,
      amount:               action === 'counter' ? charge.technicianCounterAmount : charge.agreedAmount,
      requestChargesStatus: newChargesStatus,
    });

    return res.status(200).json({
      success: true,
      message: action === 'accept' ? 'Counter-offer accepted' : 'New counter-offer submitted to admin',
      data: {
        charge,
        requestChargesStatus: newChargesStatus,
        ...(finalAmountData && { finalJobAmount: finalAmountData.total }),
      },
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

    const chargesSummary = charges.map((c) => {
      let adminAction = 'pending_review';
      let agreedPrice = null;

      if (c.status === 'accepted') { adminAction = 'accepted'; agreedPrice = c.agreedAmount; }
      else if (c.status === 'rejected')  adminAction = 'rejected';
      else if (c.status === 'countered') adminAction = 'counter_offered';

      return {
        _id:              c._id,
        label:            c.label,
        description:      c.description,
        requestedAmount:  c.requestedAmount,
        agreedAmount:     agreedPrice,
        status:           c.status,
        pendingWith:      c.pendingWith || null,
        adminAction,
        adminCounterAmount:      c.adminCounterAmount       || null,
        adminNote:               c.adminNote                || null,
        technicianCounterAmount: c.technicianCounterAmount  || null,
        technicianResponseNote:  c.technicianResponseNote   || null,
        counterHistory:          c.counterHistory           || [],
        submittedAt:             c.submittedAt,
        reviewedAt:              c.reviewedAt,
        resolvedAt:              c.resolvedAt,
        needsYourResponse:       c.status === 'countered' && c.pendingWith === 'technician',
      };
    });

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
          counterOffer:  request.counterOffer  || null,
          adminMessage:  request.adminMessage  || null,
          invoice:       request.invoice       || null,
          finalJobAmount: request.finalJobAmount || null,
        },
        charges: chargesSummary,
        summary: {
          total:             charges.length,
          pending,
          accepted,
          rejected,
          countered,
          needsYourResponse: countered,
          allResolved:       (pending === 0 && countered === 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// TECHNICIAN — Get full status of a single request (charges + invoice + next action)
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

    const pendingAdminReview = charges.filter((c) => c.status === 'pending');
    const awaitingYourReply  = charges.filter((c) => c.status === 'countered' && c.pendingWith === 'technician');
    const accepted           = charges.filter((c) => c.status === 'accepted');
    const rejected           = charges.filter((c) => c.status === 'rejected');

    let nextAction = null;
    if (request.status === 'rejected') {
      nextAction = 'Your request was rejected by admin.';
    } else if (awaitingYourReply.length > 0) {
      nextAction = `Admin has sent counter-offers on ${awaitingYourReply.length} charge(s). Please respond.`;
    } else if (pendingAdminReview.length > 0) {
      nextAction = `${pendingAdminReview.length} charge(s) waiting for admin review.`;
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
        request: {
          _id:              request._id,
          status:           request.status,
          chargesStatus:    request.chargesStatus,
          note:             request.note,
          adminMessage:     request.adminMessage || null,
          fixedPriceCounter: request.counterOffer && request.counterOfferFrom === 'admin'
            ? { amount: request.counterOffer, note: request.adminMessage }
            : null,
          agreedFixedCharge:      request.agreedFixedCharge     || null,
          agreedAdditionalTotal:  request.agreedAdditionalTotal || null,
          agreedTotal:            request.agreedTotal           || null,
          finalJobAmount:         request.finalJobAmount        || null,
          createdAt:              request.createdAt,
        },
        job:     request.job,
        invoice: request.invoice || null,
        charges: {
          pendingAdminReview: pendingAdminReview.map(fmt),
          awaitingYourReply:  awaitingYourReply.map(fmt),
          accepted:           accepted.map(fmt),
          rejected:           rejected.map(fmt),
          all:                charges.map(fmt),
        },
        summary: {
          totalCharges:       charges.length,
          pendingAdminReview: pendingAdminReview.length,
          awaitingYourReply:  awaitingYourReply.length,
          accepted:           accepted.length,
          rejected:           rejected.length,
          allResolved:        pendingAdminReview.length === 0 && awaitingYourReply.length === 0,
        },
        nextAction,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Format helper ──────────────────────────────────────────────────────────────
function fmt(c) {
  return {
    _id:                     c._id,
    label:                   c.label,
    description:             c.description,
    requestedAmount:         c.requestedAmount,
    adminCounterAmount:      c.adminCounterAmount       || null,
    adminNote:               c.adminNote                || null,
    technicianCounterAmount: c.technicianCounterAmount  || null,
    technicianResponseNote:  c.technicianResponseNote   || null,
    agreedAmount:            c.agreedAmount             || null,
    status:                  c.status,
    pendingWith:             c.pendingWith              || null,
    needsYourResponse:       c.status === 'countered' && c.pendingWith === 'technician',
    counterHistory:          c.counterHistory           || [],
    submittedAt:             c.submittedAt,
    reviewedAt:              c.reviewedAt,
    resolvedAt:              c.resolvedAt,
  };
}

// =============================================================================
// TECHNICIAN — View the final invoice
// GET /api/technician/requests/:requestId/invoice
// =============================================================================
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
    const { chargeId }  = req.params;
    const action        = req.body?.action;
    const counterAmount = req.body?.counterAmount;
    const adminNote     = req.body?.adminNote;

    if (!['accept', 'reject', 'counter'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be accept | reject | counter' });
    }

    const charge = await AdditionalCharge.findById(chargeId);
    if (!charge) return res.status(404).json({ success: false, message: 'Charge not found' });

    // Admin can act when charge is 'pending' OR 'countered' and it's their turn
    const adminCanAct =
      charge.status === 'pending' ||
      (charge.status === 'countered' && charge.pendingWith === 'admin');

    if (!adminCanAct) {
      return res.status(400).json({
        success: false,
        message: charge.status === 'countered'
          ? 'Waiting for technician to respond — you cannot act yet'
          : 'Charge is already resolved and cannot be reviewed again',
      });
    }

    const now       = new Date();
    const cleanNote = adminNote ? adminNote.trim() : '';

    // The amount being responded to:
    //   – if tech re-countered, respond to their latest counter
    //   – otherwise respond to the original request
    const activeOfferAmount =
      charge.pendingWith === 'admin' && charge.technicianCounterAmount
        ? charge.technicianCounterAmount
        : charge.requestedAmount;

    const nextRound = (charge.counterHistory?.length || 0) + 1;

    charge.adminNote  = cleanNote;
    charge.reviewedAt = now;

    switch (action) {
      case 'accept':
        charge.status       = 'accepted';
        charge.pendingWith  = null;
        charge.agreedAmount = activeOfferAmount;
        charge.resolvedAt   = now;

        charge.counterHistory.push({
          round:     nextRound,
          actor:     'admin',
          action:    'accept',
          amount:    activeOfferAmount,
          note:      cleanNote,
          createdAt: now,
        });
        break;

      case 'reject':
        charge.status      = 'rejected';
        charge.pendingWith = null;
        charge.resolvedAt  = now;

        charge.counterHistory.push({
          round:     nextRound,
          actor:     'admin',
          action:    'reject',
          amount:    null,
          note:      cleanNote,
          createdAt: now,
        });
        break;

      case 'counter': {
        const amt = Number(counterAmount);
        if (!amt || amt <= 0) {
          return res.status(400).json({ success: false, message: 'Counter amount must be > 0' });
        }

        charge.status                  = 'countered';
        charge.pendingWith             = 'technician';
        charge.adminCounterAmount      = amt;
        charge.technicianCounterAmount = null;
        charge.technicianResponseNote  = '';

        charge.counterHistory.push({
          round:     nextRound,
          actor:     'admin',
          action:    'counter',
          amount:    amt,
          note:      cleanNote,
          createdAt: now,
        });
        break;
      }

      default:
        break;
    }

    await charge.save();

    const newChargesStatus = await syncChargesStatus(charge.request.toString());

    // ── Replace any previous batched charge entry with a fresh snapshot ───────
    // One single 'charge_status_update' entry always shows ALL charges + status.
    await pushChargeStatusUpdate(charge.request.toString(), 'admin', now);

    // ── If all charges are now resolved, auto-calculate final job amount ───────
    const request = await TechnicianJobRequest.findById(charge.request).populate('job');
    let finalAmountData = null;
    if (newChargesStatus === 'agreed' && request) {
      finalAmountData = await recalculateFinalAmount(request);
      if (finalAmountData) {
        const finalEntry = {
          sender:                 'system',
          type:                   'final_amount',
          message:                `All charges agreed. Final job amount: ₹${finalAmountData.total} (Fixed: ₹${finalAmountData.fixedCharge} + Additional: ₹${finalAmountData.additionalTotal}).`,
          fixedJobCharge:         finalAmountData.fixedCharge,
          additionalChargesTotal: finalAmountData.additionalTotal,
          finalAmount:            finalAmountData.total,
          createdAt:              now,
        };
        await TechnicianJobRequest.findByIdAndUpdate(charge.request, {
          $push: { conversation: finalEntry },
        });
        await request.save();

        const jobId = request.job?._id || request.job;
        if (jobId) await TechnicianJob.findByIdAndUpdate(jobId, { finalPrice: finalAmountData.total });

        emitToRequest(charge.request.toString(), 'final_amount:calculated', { requestId: charge.request, ...finalAmountData });
        emitToAdmin('final_amount:calculated', { requestId: charge.request, ...finalAmountData });
      }
    }

    emitToRequest(charge.request.toString(), 'charge:reviewed', { chargeId, action, charge, requestChargesStatus: newChargesStatus });
    emitToAdmin('charge:reviewed', { chargeId, action, requestId: charge.request });

    return res.status(200).json({
      success: true,
      message:
        action === 'accept' ? 'Charge accepted'
        : action === 'reject' ? 'Charge rejected'
        : 'Counter-offer sent to technician',
      data: {
        charge,
        requestChargesStatus: newChargesStatus,
        ...(finalAmountData && { finalJobAmount: finalAmountData.total }),
      },
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
    const { requestId } = req.params;
    const adminNotes    = req.body?.adminNotes;

    const request = await TechnicianJobRequest.findById(requestId).populate('job');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (!['pending', 'accepted'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invoice can only be generated for a pending or accepted request',
      });
    }

    if (request.chargesStatus === 'invoiced') {
      const existing = await JobInvoice.findById(request.invoice);
      return res.status(200).json({
        success: true,
        message: 'Invoice already exists',
        data: { invoice: existing },
      });
    }

    // Block if any charge is still unresolved
    const charges    = await AdditionalCharge.find({ request: requestId });
    const unresolved = charges.filter((c) => ['pending', 'countered'].includes(c.status));
    if (unresolved.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${unresolved.length} charge(s) still pending — resolve them before generating invoice`,
      });
    }

    const job        = request.job;
    const fixedCharge = request.counterOffer > 0 ? request.counterOffer : (job.budget || 0);

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
    const now                = new Date();

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
      finalisedAt:        now,
    });

    // Update request with invoice ref + agreed totals
    request.invoice               = invoice._id;
    request.chargesStatus         = 'invoiced';
    request.agreedFixedCharge     = fixedCharge;
    request.agreedAdditionalTotal = subtotalAdditional;
    request.agreedTotal           = totalAmount;
    request.finalJobAmount        = totalAmount;
    request.amountEarned          = totalAmount;
    request.paymentStatus         = 'pending';

    // Push 'invoice_generated' conversation entry
    request.conversation.push({
      sender:                 'system',
      type:                   'invoice_generated',
      message:                `Invoice ${invoice.invoiceNumber} generated. Total: ₹${totalAmount} (Fixed: ₹${fixedCharge} + Additional: ₹${subtotalAdditional}).`,
      fixedJobCharge:         fixedCharge,
      additionalChargesTotal: subtotalAdditional,
      finalAmount:            totalAmount,
      createdAt:              now,
    });

    await request.save();

    // Update TechnicianJob.finalPrice
    await TechnicianJob.findByIdAndUpdate(job._id, { finalPrice: totalAmount });

    emitToRequest(requestId, 'invoice:generated', { requestId, invoice });
    emitToAdmin('invoice:generated', { requestId, invoice });

    return res.status(201).json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} generated — total ₹${totalAmount}`,
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
      .populate('job',        'title location category budget')
      .populate('technician', 'name phone email');

    return res.status(200).json({ success: true, data: { invoice } });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// ADMIN — Mark invoice as paid → credit technician wallet
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

    invoice.status = 'paid';
    invoice.paidAt = now;
    await invoice.save();

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

    // Update job to completed
    const job = request.job;
    if (job) {
      await TechnicianJob.findByIdAndUpdate(job._id || job, {
        status:      'completed',
        finalPrice:  amount,
        completedAt: now,
      });
    }

    const payNote = note || `Invoice ${invoice.invoiceNumber} paid. ₹${amount} credited to technician wallet.`;

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
