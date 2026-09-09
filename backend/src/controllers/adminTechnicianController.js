const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const AdditionalCharge = require('../models/AdditionalCharge');
const User = require('../models/User');
const { getIO } = require('../utils/socketInstance');
const sendNotification = require('../services/notificationService');

// Safely emit to a request-scoped room (never throws if io not ready)
const emitToRequest = (requestId, event, payload) => {
  try {
    getIO().to(`request:${requestId}`).emit(event, payload);
    console.log(`[Socket] emitToRequest → room="request:${requestId}" event="${event}"`, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[Socket] emitToRequest failed for event "${event}":`, e.message);
  }
};

// Safely emit to the admin room (never throws if io not ready)
const emitToAdmin = (event, payload) => {
  try {
    getIO().to('admin').emit(event, payload);
    console.log(`[Socket] emitToAdmin → room="admin" event="${event}"`, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[Socket] emitToAdmin failed for event "${event}":`, e.message);
  }
};

const createTechnicianJob = async (req, res, next) => {
  try {
    const {
      title,
      location,
      city,
      state,
      zipCode,
      coordinates,
      pay,
      description,
      requirements,
      preferredSkills,
      tasks,
      workType,
      additionalWorkType,
      serviceType,
      jobDate,
    } = req.body;

    // Validate required fields
    if (!title || !location || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required job fields'
      });
    }

    // Create job
    const job = await TechnicianJob.create({
      title,
      location,
      city:    city    || '',
      state:   state   || '',
      zipCode: zipCode || '',
      pay: pay || { type: 'fixed', fixedAmount: 0 },
      description,
      requirements: Array.isArray(requirements) ? requirements : [],
      coordinates: coordinates || { lat: null, lng: null },
      postedBy: req.user._id,
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      tasks: Array.isArray(tasks) ? tasks.map((t, i) => ({
        title:  t.title?.trim() || '',
        group:  t.group?.trim() || '',
        order:  t.order ?? i,
        isDone: false,
      })) : [],
      workType: workType || {},
      additionalWorkType: additionalWorkType || {},
      serviceType: serviceType || {},
      jobDate: {
        from: jobDate?.from ? new Date(jobDate.from) : null,
        to:   jobDate?.to   ? new Date(jobDate.to)   : null,
      },
    });

    // --------------------------------------------------
    // SEND NOTIFICATION TO TECHNICIANS
    // --------------------------------------------------

    try {
      // Find active technicians
      const technicians = await User.find({
        role: 'technician',
        isActive: true,
        fcmTokens: {
          $exists: true,
          $ne: []
        }
      }).select('_id fcmTokens');

      if (technicians.length > 0) {

        await sendNotification({
          recipients: technicians,
          sender: req.user._id,

          type: 'new_job',

          title: 'New Job Available',

          message: `A new ${job.title} job is available.`,

          data: {
            jobId: job._id.toString(),
            type: 'new_job',
          },
        });

      }

    } catch (notificationError) {

      // Notification failure should NOT make
      // the job creation API fail.

      console.error(
        'Failed to send new job notification:',
        notificationError
      );
    }

    // Notify admin room about new job
    emitToAdmin('job:created', { job });

    // Broadcast to ALL connected clients (technicians) so their dashboards update live
    try {
      getIO().emit('job:new', { job });
      console.log(`[Socket] broadcast → event="job:new" jobId="${job._id}" title="${job.title}"`);
    } catch (e) {
      console.warn('[Socket] broadcast failed for event "job:new":', e.message);
    }

    // API response
    return res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      data: {
        job
      }
    });

  } catch (error) {
    next(error);
  }
};

const getTechnicianJobs = async (req, res, next) => {
  try {
    const jobs = await TechnicianJob.find().sort('-createdAt');
    res.status(200).json({ success: true, data: { jobs } });
  } catch (error) {
    next(error);
  }
};

const getTechnicianRequests = async (req, res, next) => {
  try {
    const requests = await TechnicianJobRequest.find()
      .populate('job')
      .populate('technician')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: { requests } });
  } catch (error) {
    next(error);
  }
};

const updateTechnicianRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, adminMessage, counterOffer } = req.body;

    console.log(`[Admin] updateTechnicianRequest called → requestId="${requestId}" status="${status}"`);

    if (!['accepted', 'rejected', 'counter-offer'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid request status' });
    }

    const request = await TechnicianJobRequest.findById(requestId).populate('technician job');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const now          = new Date();
    const offerAmount  = Number(counterOffer || 0);
    const cleanMessage = adminMessage ? adminMessage.trim() : '';

    request.status       = status;
    request.adminMessage = cleanMessage;

    // ── Build a typed conversation entry ─────────────────────────────────
    let convEntry;

    if (status === 'accepted') {
      convEntry = {
        sender:    'admin',
        type:      'message',
        message:   cleanMessage || 'Request accepted.',
        createdAt: now,
      };
    } else if (status === 'rejected') {
      convEntry = {
        sender:    'admin',
        type:      'message',
        message:   cleanMessage || 'Request rejected.',
        createdAt: now,
      };
    } else {
      // counter-offer on the fixed job price
      request.counterOfferFrom = 'admin';
      request.counterOffer     = offerAmount;

      convEntry = {
        sender:           'admin',
        type:             'fixed_charge',
        message:          cleanMessage || `Counter offer: ₹${offerAmount}`,
        fixedCharge:      offerAmount,
        counterOffer:     offerAmount,
        counterOfferFrom: 'admin',
        createdAt:        now,
      };
    }

    request.conversation = request.conversation || [];
    request.conversation.push(convEntry);

    // ── On accept: assign job + calculate final amount ────────────────────
    let finalAmountData = null;

    if (status === 'accepted') {
      const job        = request.job._id ? request.job : await TechnicianJob.findById(request.job);
      const technician = request.technician._id
        ? request.technician
        : await User.findById(request.technician);

      if (job) {
        job.status             = 'assigned';
        job.assignedTechnician = {
          _id:   technician._id,
          name:  technician.name,
          email: technician.email,
          phone: technician.phone,
        };
        job.assignedRequest = request._id;
        job.conversation    = job.conversation || [];
        job.conversation.push({
          sender:    'admin',
          message:   `${technician.name} has been assigned to this job.`,
          createdAt: now,
        });
        await job.save();
      }

      request.completedAt   = null;
      request.paymentStatus = 'pending';
      request.amountEarned  = 0;

      // ── Calculate final job amount once the request is accepted ──────
      // Derive the base fixed charge from the structured pay object.
      // For hourly/perDevice/blended, use the counter-offer if set, otherwise
      // derive a best-estimate from the pay fields so invoicing has a value.
      const p = job?.pay || {};
      let derivedBase = 0;
      switch (p.type) {
        case 'fixed':
          derivedBase = p.fixedAmount || 0; break;
        case 'hourly':
          derivedBase = (p.hourlyRate || 0) * (p.maxHours || 0); break;
        case 'perDevice':
          derivedBase = (p.perDeviceRate || 0) * (p.maxDevices || 0); break;
        case 'blended':
          derivedBase = (p.blendedFixedAmount || 0) +
            (p.blendedHourlyRate || 0) * (p.blendedMaxAddlHours || 0); break;
        default:
          derivedBase = 0;
      }
      const fixedCharge = request.counterOffer > 0 ? request.counterOffer : derivedBase;

      // Sum all *already accepted* additional charges for this request
      const acceptedCharges = await AdditionalCharge.find({
        request: requestId,
        status:  'accepted',
      });
      const additionalTotal = acceptedCharges.reduce((sum, c) => sum + (c.agreedAmount || 0), 0);
      const totalAmount     = fixedCharge + additionalTotal;

      request.agreedFixedCharge     = fixedCharge;
      request.agreedAdditionalTotal = additionalTotal;
      request.agreedTotal           = totalAmount;
      request.finalJobAmount        = totalAmount;

      finalAmountData = { fixedCharge, additionalTotal, total: totalAmount };

      // Push a 'final_amount' system entry so the timeline shows the breakdown
      request.conversation.push({
        sender:                 'system',
        type:                   'final_amount',
        message:                `Request accepted. Final job amount: ₹${totalAmount} (Fixed: ₹${fixedCharge}${additionalTotal > 0 ? ` + Additional: ₹${additionalTotal}` : ''}).`,
        fixedJobCharge:         fixedCharge,
        additionalChargesTotal: additionalTotal,
        finalAmount:            totalAmount,
        createdAt:              now,
      });

      // Mirror the final price on the job document
      if (job) {
        await TechnicianJob.findByIdAndUpdate(job._id, { finalPrice: totalAmount });
      }
    }

    await request.save();

    // ── Real-time notifications ───────────────────────────────────────────
    const latestMsg = request.conversation[request.conversation.length - 1];
    emitToRequest(requestId, 'request:message', { requestId, message: latestMsg });
    emitToRequest(requestId, 'request:status',  { requestId, status: request.status });

    if (finalAmountData) {
      emitToRequest(requestId, 'final_amount:calculated', {
        requestId,
        ...finalAmountData,
      });
      emitToAdmin('final_amount:calculated', { requestId, ...finalAmountData });
    }

    res.status(200).json({
      success: true,
      message: 'Request status updated',
      data: {
        request,
        ...(finalAmountData && { finalJobAmount: finalAmountData.total }),
      },
    });
    emitToAdmin('request:updated', { request });
  } catch (error) {
    next(error);
  }
};

const updateTechnicianJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { title, location, city, state, zipCode, coordinates, pay, description, requirements, preferredSkills, tasks, workType, additionalWorkType, serviceType, jobDate } = req.body;

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (title) job.title = title;
    if (location) job.location = location;
    if (city    !== undefined) job.city    = city    || '';
    if (state   !== undefined) job.state   = state   || '';
    if (zipCode !== undefined) job.zipCode = zipCode || '';
    if (coordinates) job.coordinates = coordinates;
    if (pay !== undefined) job.pay = pay || { type: 'fixed', fixedAmount: 0 };
    if (description) job.description = description;
    if (Array.isArray(requirements)) job.requirements = requirements;
    if (Array.isArray(preferredSkills)) job.preferredSkills = preferredSkills;
    if (workType !== undefined) job.workType = workType || {};
    if (additionalWorkType !== undefined) job.additionalWorkType = additionalWorkType || {};
    if (serviceType !== undefined) job.serviceType = serviceType || {};
    if (jobDate !== undefined) {
      job.jobDate = {
        from: jobDate?.from ? new Date(jobDate.from) : null,
        to:   jobDate?.to   ? new Date(jobDate.to)   : null,
      };
    }
    if (Array.isArray(tasks)) {
      job.tasks = tasks.map((t, i) => ({
        // Preserve existing subdocument _id so Mongoose doesn't regenerate it
        ...(t._id && { _id: t._id }),
        title:          t.title?.trim()  || '',
        group:          t.group?.trim()  || '',
        order:          t.order          ?? i,
        isDone:         t.isDone         || false,
        checkedAt:      t.checkedAt      || null,
        technicianLat:  t.technicianLat  || null,
        technicianLng:  t.technicianLng  || null,
        distanceMeters: t.distanceMeters || null,
      }));
    }

    await job.save();
    res.status(200).json({ success: true, message: 'Job updated successfully', data: { job } });
    emitToAdmin('job:updated', { job });
  } catch (error) {
    next(error);
  }
};

const deleteTechnicianJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await TechnicianJob.findByIdAndDelete(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.status(200).json({ success: true, message: 'Job deleted successfully' });
    emitToAdmin('job:deleted', { jobId });
  } catch (error) {
    next(error);
  }
};

const updateTechnicianJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, finalPrice, note } = req.body;

    const validStatuses = ['open', 'assigned', 'ontheway', 'visited', 'inprogress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid job status' });
    }

    const job = await TechnicianJob.findById(jobId).populate('assignedRequest');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = status;

    // Push to audit trail — always, even if note is empty
    const now = new Date();
    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({
      status,
      note:      note ? note.trim() : '',
      changedAt: now,
    });

    // Also write to conversation so technician sees the update
    if (note && note.trim()) {
      job.conversation = job.conversation || [];
      job.conversation.push({ sender: 'admin', message: note.trim(), createdAt: now });
    }

    if (finalPrice !== undefined) {
      job.finalPrice = Number(finalPrice || 0);
    }

    if (status === 'completed') {
      const now = new Date();
      job.completedAt = now;
      job.jobCompletedAt = now;

      // Calculate duration from when technician marked job started (reachedAt) to completion
      const startRef = job.jobStartedAt || job.reachedAt;
      if (startRef) {
        const diffMs = now - new Date(startRef);
        job.jobDurationMinutes = Math.round(diffMs / 60000);
      }

      const finalAmount = Number(job.finalPrice || 0);
      const request = await TechnicianJobRequest.findById(job.assignedRequest?._id || job.assignedRequest);
      if (request) {
        request.amountEarned = finalAmount;
        request.paymentStatus = 'pending';
        request.completedAt = now;
        request.conversation = request.conversation || [];
        request.conversation.push({ sender: 'admin', message: `Job completed. Final price: $${finalAmount}`, createdAt: new Date() });
        await request.save();
      }
    }

    if (status === 'completed' && Number(job.finalPrice || 0) > 0 && job.assignedTechnician?._id) {
      const technician = await User.findById(job.assignedTechnician._id);
      if (technician) {
        technician.totalEarnings = (technician.totalEarnings || 0) + Number(job.finalPrice || 0);
        technician.totalJobsDone = (technician.totalJobsDone || 0) + 1;
        await technician.save();
      }
    }

    await job.save();
    res.status(200).json({ success: true, message: 'Job status updated', data: { job } });
    emitToAdmin('job:updated', { job });
  } catch (error) {
    next(error);
  }
};

// ── Send a chat message without changing status ──────────────────────────────
const sendTechnicianRequestMessage = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { message, counterOffer, counterOfferFrom } = req.body;

    const trimmedMessage = message && message.trim();
    const offerAmount    = Number(counterOffer || 0);

    if (!trimmedMessage && offerAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const request = await TechnicianJobRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (offerAmount > 0) {
      request.status           = 'counter-offer';
      request.counterOffer     = offerAmount;
      request.counterOfferFrom = 'admin';
      request.adminMessage     = trimmedMessage || `Counter offer sent: ₹${offerAmount}`;
    } else if (trimmedMessage) {
      request.adminMessage = trimmedMessage;
    }

    const now = new Date();
    const entry = offerAmount > 0
      ? {
          sender:           'admin',
          type:             'fixed_charge',
          message:          trimmedMessage || `Counter offer: ₹${offerAmount}`,
          fixedCharge:      offerAmount,
          counterOffer:     offerAmount,
          counterOfferFrom: counterOfferFrom || 'admin',
          createdAt:        now,
        }
      : {
          sender:    'admin',
          type:      'message',
          message:   trimmedMessage,
          createdAt: now,
        };

    request.conversation = request.conversation || [];
    request.conversation.push(entry);
    await request.save();

    const newMsg = request.conversation[request.conversation.length - 1];
    emitToRequest(requestId, 'request:message', { requestId, message: newMsg });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status:           request.status,
      counterOffer:     request.counterOffer,
      counterOfferFrom: request.counterOfferFrom,
    });

    res.status(200).json({ success: true, message: 'Message sent', data: { request } });
  } catch (error) {
    next(error);
  }
};

// ── Pay technician: set final price and credit wallet ───────────────────────
const payTechnicianWallet = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { finalPrice, note } = req.body;

    if (!finalPrice || Number(finalPrice) <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid final price' });
    }

    const job = await TechnicianJob.findById(jobId).populate('assignedRequest');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Job must be completed before payment' });
    }

    if (!job.assignedTechnician?._id) {
      return res.status(400).json({ success: false, message: 'No technician assigned to this job' });
    }

    const amount = Number(finalPrice);
    job.finalPrice = amount;

    const payNote = note || `Payment of $${amount} credited to wallet.`;
    job.conversation = job.conversation || [];
    job.conversation.push({ sender: 'admin', message: payNote, createdAt: new Date() });
    await job.save();

    // Credit the technician's wallet
    const technician = await User.findById(job.assignedTechnician._id);
    if (technician) {
      technician.totalEarnings = (technician.totalEarnings || 0) + amount;
      technician.totalJobsDone = (technician.totalJobsDone || 0) + 1;
      await technician.save();
    }

    // Update the job request payment status
    const request = await TechnicianJobRequest.findById(job.assignedRequest?._id || job.assignedRequest);
    if (request) {
      request.amountEarned = amount;
      request.paymentStatus = 'paid';
      request.conversation = request.conversation || [];
      request.conversation.push({ sender: 'admin', message: payNote, createdAt: new Date() });
      await request.save();
    }

    res.status(200).json({
      success: true,
      message: `$${amount} credited to technician wallet`,
      data: { job, technicianBalance: technician ? technician.totalEarnings - (technician.totalWithdrawn || 0) : 0 },
    });
    emitToAdmin('job:updated', { job });
  } catch (error) {
    next(error);
  }
};

const rescheduleJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { jobDateFrom, jobDateTo, reason } = req.body;

    if (!jobDateFrom || !jobDateTo) {
      return res.status(400).json({ success: false, message: 'Please provide both jobDateFrom and jobDateTo' });
    }

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const newFrom = new Date(jobDateFrom);
    const newTo   = new Date(jobDateTo);

    if (isNaN(newFrom.getTime()) || isNaN(newTo.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    if (newFrom >= newTo) {
      return res.status(400).json({ success: false, message: '"From" must be before "To"' });
    }

    job.rescheduleHistory = job.rescheduleHistory || [];
    job.rescheduleHistory.push({
      previousDate:  job.jobDate?.from || job.scheduledDate || null,
      newDate:       newFrom,
      reason:        reason || '',
      rescheduledAt: new Date(),
    });

    job.jobDate       = { from: newFrom, to: newTo };
    job.scheduledDate = newFrom;

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender:    'admin',
      message:   `Job rescheduled to ${newFrom.toLocaleString('en-IN')} → ${newTo.toLocaleString('en-IN')}${reason ? `. Reason: ${reason}` : ''}.`,
      createdAt: new Date(),
    });

    await job.save();

    res.status(200).json({ success: true, message: 'Job rescheduled successfully', data: { job } });
    emitToAdmin('job:updated', { job });
  } catch (error) {
    next(error);
  }
};

// ── Format a single conversation entry for the timeline API ─────────────────
const formatConvEntry = (entry) => {
  const base = {
    _id:       entry._id,
    sender:    entry.sender,
    type:      entry.type || 'message',
    message:   entry.message,
    createdAt: entry.createdAt,
  };

  switch (entry.type) {
    case 'fixed_charge':
      return { ...base, fixedCharge: entry.fixedCharge, counterOfferFrom: entry.counterOfferFrom };
    case 'charge_submitted':
      return { ...base, charges: entry.charges || [] };
    case 'charge_reviewed':
    case 'charge_responded':
      return { ...base, chargeId: entry.chargeId, chargeLabel: entry.chargeLabel, action: entry.action, amount: entry.amount, note: entry.note };
    case 'final_amount':
    case 'invoice_generated':
      return { ...base, fixedJobCharge: entry.fixedJobCharge, additionalChargesTotal: entry.additionalChargesTotal, finalAmount: entry.finalAmount };
    default:
      return base;
  }
};

/**
 * GET /api/admin/technician-requests/:requestId/conversation
 * Returns the full typed conversation timeline for a request — admin view.
 */
const getRequestConversation = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId)
      .populate('job',        'title location pay category status')
      .populate('technician', 'name phone email')
      .select('conversation status chargesStatus finalJobAmount agreedTotal agreedFixedCharge agreedAdditionalTotal job technician');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const conversation = (request.conversation || []).map(formatConvEntry);

    return res.status(200).json({
      success: true,
      data: {
        requestId:      request._id,
        status:         request.status,
        chargesStatus:  request.chargesStatus,
        finalJobAmount: request.finalJobAmount || null,
        agreedTotal:    request.agreedTotal    || null,
        job:            request.job,
        technician:     request.technician,
        conversation,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTechnicianJob,
  getTechnicianJobs,
  getTechnicianRequests,
  updateTechnicianRequest,
  sendTechnicianRequestMessage,
  getRequestConversation,
  updateTechnicianJob,
  deleteTechnicianJob,
  updateTechnicianJobStatus,
  payTechnicianWallet,
  rescheduleJob,
};
