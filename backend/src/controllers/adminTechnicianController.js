const { validateFeedback, saveTechnicianRating } = require('../services/technicianRating');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const AdditionalCharge = require('../models/AdditionalCharge');
const User = require('../models/User');
const { getIO } = require('../utils/socketInstance');
const sendNotification = require('../services/notificationService');
const { sendToTechnician } = sendNotification;
const { tryAssignApprovedRequest } = require('../services/technicianRequestWorkflow');
const { findTechnicianScheduleConflict } = require('../services/technicianScheduleService');
const { syncBookingFromTechnicianJob } = require('../services/bookingTechnicianJobSync');

// ── Helper: keep only the fields that belong to the selected pay type ────────
// This prevents the DB from storing zeros for fields that were never filled in.
const sanitizePay = (raw = {}) => {
  const type = raw.type || 'fixed';
  const cleaned = { type };

  // Helper — only add a numeric field when it has a real non-zero value
  const addNum = (key) => {
    const v = Number(raw[key]);
    if (!isNaN(v) && v > 0) cleaned[key] = v;
  };

  // Shared optional text field (all types may include it)
  if (raw.approxHours && String(raw.approxHours).trim()) {
    cleaned.approxHours = String(raw.approxHours).trim();
  }

  switch (type) {
    case 'fixed':
      addNum('fixedAmount');
      break;

    case 'hourly':
      addNum('hourlyRate');
      addNum('maxHours');
      break;

    case 'perDevice':
      addNum('perDeviceRate');
      addNum('maxDevices');
      break;

    case 'blended':
      addNum('blendedFixedAmount');
      addNum('blendedFixedHours');
      addNum('blendedHourlyRate');
      addNum('blendedMaxAddlHours');
      break;

    default:
      break;
  }

  return cleaned;
};

const getPayAmount = (pay = {}) => {
  switch (pay.type) {
    case 'hourly':
      return (Number(pay.hourlyRate) || 0) * (Number(pay.maxHours) || 0);
    case 'perDevice':
      return (Number(pay.perDeviceRate) || 0) * (Number(pay.maxDevices) || 0);
    case 'blended':
      return (Number(pay.blendedFixedAmount) || 0) +
        ((Number(pay.blendedHourlyRate) || 0) * (Number(pay.blendedMaxAddlHours) || 0));
    case 'fixed':
    default:
      return Number(pay.fixedAmount) || 0;
  }
};

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

const emitToTechnician = (technicianId, event, payload) => {
  try {
    if (technicianId) getIO().to(`technician:${technicianId}`).emit(event, payload);
  } catch (e) {
    console.warn(`[Socket] emitToTechnician failed for event "${event}":`, e.message);
  }
};

const publishJobToTechnicians = async (job, sender) => {
  try {
    const technicians = await User.find({
      role: 'technician',
      $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }],
    }).select('_id fcmTokens');
    if (technicians.length) {
      await sendNotification({
        recipients: technicians,
        sender,
        type: 'new_job',
        title: 'New Job Available',
        message: `A new ${job.title} job is available.`,
        data: { jobId: job._id.toString(), type: 'new_job' },
      });
    }
  } catch (error) {
    console.error('Failed to send new job notification:', error);
  }

  try {
    getIO().emit('job:new', { job });
  } catch (error) {
    console.warn('[Socket] broadcast failed for published job:', error.message);
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
      scheduledDate,
      visibleTo,
    } = req.body;

    // Validate required fields
    if (!title || !location || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required job fields'
      });
    }
    if (getPayAmount(pay) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid job price in the payment section',
      });
    }
    const missingRequirementReason = Array.isArray(tasks) && tasks.findIndex((task) =>
      (task.requiresNote || task.requiresImage || task.requiresSignature) &&
      !String(task.requirementReason || '').trim()
    );
    if (missingRequirementReason >= 0) {
      return res.status(400).json({ success: false, message: `Enter a reason for the completion requirement on task ${missingRequirementReason + 1}` });
    }

    // Create job
    const job = await TechnicianJob.create({
      title,
      location,
      city:    city    || '',
      state:   state   || '',
      zipCode: zipCode || '',
      pay: sanitizePay(pay),
      description,
      requirements: Array.isArray(requirements) ? requirements : [],
      coordinates: coordinates || { lat: null, lng: null },
      postedBy: req.user._id,
      scheduledDate: scheduledDate || null,
      visibleTo: visibleTo || 'technicians',
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      tasks: Array.isArray(tasks) ? tasks.map((t, i) => ({
        title:  t.title?.trim() || '',
        group:  t.group?.trim() || '',
        order:  t.order ?? i,
        isDone: false,
        ...(t.requiresNote && { requiresNote: true }),
        ...(t.requiresImage && { requiresImage: true }),
        ...(t.requiresSignature && { requiresSignature: true }),
        ...((t.requiresNote || t.requiresImage || t.requiresSignature) && { requirementReason: String(t.requirementReason || '').trim() }),
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
        $or: [
          { accountStatus: 'active' },
          { accountStatus: { $exists: false } },
        ],
      }).select('_id fcmTokens');

      if (technicians.length > 0) {

        await sendNotification({
          recipients: technicians,
          sender: req.user,

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
    const jobs = await TechnicianJob.find().select('+privateTechnicianFeedback').sort('-createdAt');
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

    if (status === 'accepted') {
      if (!request.job || !request.technician) return res.status(404).json({ success: false, message: 'Job or technician no longer exists.' });
      if (['invited', 'suspended', 'blocked'].includes(request.technician.accountStatus)) return res.status(400).json({ success: false, message: 'Only active technicians can be assigned.' });
      if (!['pending', 'counter-offer'].includes(request.status) || request.job.status !== 'open') return res.status(409).json({ success: false, message: 'This request is no longer available for assignment.' });

      const scheduleConflict = await findTechnicianScheduleConflict(
        request.technician._id,
        request.job,
        { excludeJobId: request.job._id },
      );
      if (scheduleConflict) {
        return res.status(409).json({
          success: false,
          message: 'The technician already has an assigned job during this time.',
          data: {
            conflictingJobId: scheduleConflict._id,
            conflictingJobTitle: scheduleConflict.title,
            conflictingJobDate: scheduleConflict.jobDate,
          },
        });
      }

      const unresolvedCharges = await AdditionalCharge.countDocuments({ request: requestId, status: { $in: ['pending', 'countered'] } });
      if (unresolvedCharges > 0) {
        request.status = 'accepted';
        request.adminApproved = true;
        request.adminMessage = 'Request approved. Assignment will complete after charge negotiation.';
        request.conversation.push({ sender: 'admin', type: 'message', message: request.adminMessage, createdAt: new Date() });
        await request.save();
        emitToRequest(requestId, 'request:status', { requestId, status: request.status, adminApproved: true, waitingForCharges: true });
        emitToRequest(requestId, 'request:updated', { request });
        emitToAdmin('request:updated', { request });
        return res.status(200).json({ success: true, message: 'Request approved; resolve all charges before assignment.', data: { request, waitingForCharges: true } });
      }
    }

    if (request.initiatedBy === 'admin') return res.status(403).json({ success: false, message: 'Only the invited technician can respond to this invitation.' });

    const now          = new Date();
    const offerAmount  = Number(counterOffer || 0);
    const cleanMessage = adminMessage ? adminMessage.trim() : '';

    request.status       = status;
    request.adminApproved = status === 'accepted';
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
      await TechnicianJob.updateOne(
        { _id: request.job?._id || request.job },
        { $pull: { requestedBy: request.technician?._id || request.technician } },
      );

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
        // Claim the open job atomically so two administrators cannot assign it twice.
        const claimed = await TechnicianJob.findOneAndUpdate(
          { _id: job._id, status: 'open' },
          { $set: {
              status: 'assigned', assignedRequest: request._id,
              assignedTechnician: { _id: technician._id, name: technician.name, email: technician.email, phone: technician.phone },
            },
            $push: { conversation: { sender: 'admin', message: `${technician.name} has been assigned to this job.`, createdAt: now } },
          },
          { new: true, runValidators: true },
        );
        if (!claimed) return res.status(409).json({ success: false, message: 'This job has already been assigned.' });
        Object.assign(job, { status: claimed.status, assignedTechnician: claimed.assignedTechnician, assignedRequest: claimed.assignedRequest });
        await syncBookingFromTechnicianJob(claimed);
        await sendToTechnician(technician._id, {
          type: 'job_assigned',
          title: 'Job Assigned',
          message: `You have been assigned to ${job.title}.`,
          data: { jobId: String(job._id), requestId: String(request._id) },
        }, req.user);
      }

      request.completedAt   = null;
      request.paymentStatus = 'pending';
      request.amountEarned  = 0;

      // ── Calculate final job amount once the request is accepted ──────
      // Derive the base fixed charge from the structured pay object.
      // Fields not relevant to the chosen type may be undefined now that
      // we no longer persist zeros — guard with || 0 throughout.
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
    emitToTechnician(request.technician?._id || request.technician, 'request:message', { requestId, message: latestMsg });
    emitToTechnician(request.technician?._id || request.technician, 'request:status', { requestId, status: request.status, adminApproved: request.adminApproved });

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
    emitToTechnician(request.technician?._id || request.technician, 'request:updated', { request });
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

    if (req.body.scheduledDate !== undefined) job.scheduledDate = req.body.scheduledDate || null;
    if (req.body.visibleTo !== undefined) job.visibleTo = req.body.visibleTo;
    if (title) job.title = title;
    if (location) job.location = location;
    if (city    !== undefined) job.city    = city    || '';
    if (state   !== undefined) job.state   = state   || '';
    if (zipCode !== undefined) job.zipCode = zipCode || '';
    if (coordinates) job.coordinates = coordinates;
    if (pay !== undefined) job.pay = sanitizePay(pay);
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
      const missingRequirementReason = tasks.findIndex((task) =>
        (task.requiresNote || task.requiresImage || task.requiresSignature) &&
        !String(task.requirementReason || '').trim()
      );
      if (missingRequirementReason >= 0) {
        return res.status(400).json({ success: false, message: `Enter a reason for the completion requirement on task ${missingRequirementReason + 1}` });
      }
      job.tasks = tasks.map((t, i) => ({
        // Preserve existing subdocument _id so Mongoose doesn't regenerate it
        ...(t._id && { _id: t._id }),
        title:          t.title?.trim()  || '',
        group:          t.group?.trim()  || '',
        order:          t.order          ?? i,
        isDone:         t.isDone         || false,
        ...(t.requiresNote && { requiresNote: true }),
        ...(t.requiresImage && { requiresImage: true }),
        ...(t.requiresSignature && { requiresSignature: true }),
        ...((t.requiresNote || t.requiresImage || t.requiresSignature) && { requirementReason: String(t.requirementReason || '').trim() }),
        completionNote:      t.completionNote      || undefined,
        completionImage:     t.completionImage     || undefined,
        completionSignature: t.completionSignature || undefined,
        checkedAt:      t.checkedAt      || null,
        technicianLat:  t.technicianLat  || null,
        technicianLng:  t.technicianLng  || null,
        distanceMiles:  t.distanceMiles  ?? null,
        distanceMeters: t.distanceMeters ?? null,
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
    const { status, note } = req.body;

    const validStatuses = ['open', 'assigned', 'ontheway', 'visited', 'inprogress', 'checkout', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid job status' });
    }

    const job = await TechnicianJob.findById(jobId).populate('assignedRequest');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const publishingDraft = job.status === 'draft' && status === 'open';
    if (publishingDraft && getPayAmount(job.pay) <= 0) {
      return res.status(400).json({ success: false, message: 'Set the technician pay in the draft before publishing this work order.' });
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

    await job.save();
    if (publishingDraft) await publishJobToTechnicians(job, req.user);
    await syncBookingFromTechnicianJob(job);
    res.status(200).json({ success: true, message: 'Job status updated', data: { job } });
    emitToAdmin('job:updated', { job });
  } catch (error) {
    next(error);
  }
};

const unassignTechnicianJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 1000) {
      return res.status(400).json({ success: false, message: 'Provide an unassignment reason of up to 1000 characters.' });
    }

    let job;
    let request;
    let technicianId;
    await TechnicianJob.db.transaction(async session => {
      const currentJob = await TechnicianJob.findById(jobId).session(session);
      if (!currentJob) {
        const error = new Error('Job not found');
        error.statusCode = 404;
        throw error;
      }
      if (!currentJob.assignedTechnician?._id || !currentJob.assignedRequest) {
        const error = new Error('This job does not have an active technician assignment.');
        error.statusCode = 409;
        throw error;
      }
      if (!['assigned', 'ontheway', 'visited', 'inprogress', 'in-progress'].includes(currentJob.status)) {
        const error = new Error('Only active assignments can be unassigned.');
        error.statusCode = 409;
        throw error;
      }
      if (currentJob.payment?.status === 'paid') {
        const error = new Error('A paid job cannot be unassigned.');
        error.statusCode = 409;
        throw error;
      }

      technicianId = currentJob.assignedTechnician._id;
      request = await TechnicianJobRequest.findById(currentJob.assignedRequest).session(session);
      const now = new Date();
      if (request) {
        request.status = 'rejected';
        request.adminMessage = `Assignment ended: ${reason}`;
        request.respondedAt = now;
        request.releasedAt = now;
        request.paymentStatus = 'unpaid';
        request.completedAt = null;
        request.amountEarned = 0;
        request.finalJobAmount = null;
        request.conversation.push({ sender: 'admin', message: `Technician unassigned. Reason: ${reason}`, createdAt: now });
        await request.save({ session });
      }

      currentJob.status = 'open';
      currentJob.assignedTechnician = { _id: null, name: '', email: '', phone: '' };
      currentJob.assignedRequest = null;
      currentJob.visibleTo = 'technicians';
      currentJob.requestedBy = [];
      currentJob.reachedAt = null;
      currentJob.reachedStatus = { at: null, lat: null, lng: null, distanceMiles: null, siteStatus: null };
      currentJob.jobStartedAt = null;
      currentJob.jobCompletedAt = null;
      currentJob.completedStatus = { at: null, lat: null, lng: null, distanceMiles: null, distanceMeters: null, siteStatus: null };
      currentJob.jobDurationMinutes = null;
      currentJob.completedAt = null;
      currentJob.finalPrice = 0;
      currentJob.tasks = (currentJob.tasks || []).map(task => ({
        ...task.toObject(),
        isDone: false,
        checkedAt: null,
        technicianLat: null,
        technicianLng: null,
        distanceMiles: null,
        distanceMeters: null,
        completionNote: undefined,
        completionImage: undefined,
        completionSignature: undefined,
      }));
      currentJob.statusHistory.push({ status: 'open', note: `Technician unassigned. Reason: ${reason}`, changedAt: now });
      currentJob.conversation.push({ sender: 'admin', message: `Technician unassigned. Reason: ${reason}`, createdAt: now });
      job = await currentJob.save({ session });
    });

    await syncBookingFromTechnicianJob(job);
    request = request ? await TechnicianJobRequest.findById(request._id).populate('job technician') : null;
    emitToAdmin('job:updated', { job });
    emitToAdmin('job:availability', { jobId: String(job._id), status: job.status });
    if (request) emitToAdmin('request:updated', { request });
    emitToTechnician(technicianId, 'job:unassigned', { jobId: String(job._id), reason });
    try {
      getIO().emit('job:availability', { jobId: String(job._id), status: job.status });
    } catch (error) {
      console.warn('Failed to broadcast reopened job:', error.message);
    }
    await sendToTechnician(technicianId, {
      type: 'job_unassigned',
      title: 'Job Assignment Ended',
      message: `You have been unassigned from ${job.title}. Reason: ${reason}`,
      data: { jobId: String(job._id) },
    }, req.user);
    res.status(200).json({ success: true, message: 'Technician unassigned and job reopened.', data: { job } });
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

    if (request.initiatedBy === 'admin' && offerAmount > 0) return res.status(400).json({ success: false, message: 'The invited technician must respond to the original job offer.' });

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

    if (offerAmount > 0) {
      await sendNotification.sendToTechnician(request.technician, {
        type: 'admin_counter_offer',
        title: 'Admin Counter Offer',
        message: `Admin sent a counter offer for your job request.`,
        data: { jobId: String(request.job), requestId: String(request._id) },
      }, req.user);
    }

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

// ── Approve checkout: finalize the job and credit the admin wallet ──────────
const payTechnician = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { discount = 0, note = '', feedback } = req.body || {};
    if (feedback != null) {
      try { validateFeedback(feedback); }
      catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    }

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'checkout') {
      return res.status(400).json({ success: false, message: 'Job must be in checkout before payment' });
    }

    if (!job.assignedTechnician?._id) {
      return res.status(400).json({ success: false, message: 'No technician assigned to this job' });
    }

    const basePrice = Number(job.finalPrice || job.pay?.fixedAmount || job.pay?.blendedFixedAmount || 0);
    const discountAmount = Number(discount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > basePrice) {
      return res.status(400).json({ success: false, message: 'Discount must be between 0 and the job price' });
    }
    const amount = basePrice - discountAmount;

    const payNote = String(note || '').trim() || `Technician payment approved for $${amount}.`;
    job.conversation = job.conversation || [];
    job.conversation.push({ sender: 'admin', message: payNote, createdAt: new Date() });
    job.status = 'completed';
    job.completedAt = job.completedAt || new Date();
    job.finalPrice = amount;
    job.payment = { status: 'paid', basePrice, discount: discountAmount, note: payNote, paidAt: new Date(), paidBy: req.user._id };
    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({ status: 'completed', note: payNote, changedAt: new Date() });
    await job.save();
    await syncBookingFromTechnicianJob(job);

    const admin = await require('../models/Admin').findByIdAndUpdate(req.user._id, {
      $inc: { walletBalance: amount },
      $push: { walletTransactions: { type: 'technician_payment', job: job._id, amount, note: payNote } },
    }, { new: true });

    const technician = await User.findByIdAndUpdate(job.assignedTechnician._id, {
      $inc: { totalEarnings: amount, totalJobsDone: 1 },
    }, { new: true });

    await sendToTechnician(job.assignedTechnician._id, {
      type: 'wallet_payment',
      title: 'Payment Added to Wallet',
      message: `$${amount} has been credited to your wallet for ${job.title}.`,
      data: { jobId: String(job._id), amount },
    }, req.user);

    const request = await TechnicianJobRequest.findById(job.assignedRequest);
    if (request) {
      request.amountEarned = amount;
      request.paymentStatus = 'paid';
      request.completedAt = job.completedAt;
      request.conversation = request.conversation || [];
      request.conversation.push({ sender: 'admin', message: payNote, createdAt: new Date() });
      await request.save();
    }

    let ratingWarning;
    if (feedback != null) {
      try {
        const ratedJob = await saveTechnicianRating(job._id, feedback, req.user._id);
        job.technicianRating = ratedJob.technicianRating;
      } catch (error) {
        ratingWarning = 'Payment succeeded, but feedback could not be fully saved. Open the work order to retry.';
        console.error('Payment feedback failed:', error.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Payment approved. $${amount} credited to technician wallet.`,
      data: {
        job,
        ratingWarning,
        adminWalletBalance: admin?.walletBalance || 0,
        technicianBalance: technician
          ? technician.totalEarnings - (technician.totalWithdrawn || 0)
          : 0,
      },
    });
    emitToAdmin('job:updated', { job });
    emitToTechnician(job.assignedTechnician._id, 'job:updated', { job });
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

    if (job.assignedTechnician?._id) {
      await sendToTechnician(job.assignedTechnician._id, {
        type: 'job_rescheduled',
        title: 'Job Rescheduled',
        message: `${job.title} was rescheduled to ${newFrom.toLocaleString('en-IN')}.`,
        data: { jobId: String(job._id), jobDateFrom: newFrom.toISOString(), jobDateTo: newTo.toISOString() },
      }, req.user);
    }

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

const rateTechnician = async (req, res, next) => {
  try {
    const job = await saveTechnicianRating(req.params.jobId, req.body, req.user._id);
    emitToAdmin('job:updated', { job });
    emitToTechnician(job.assignedTechnician._id, 'job:updated', { job });
    res.json({ success: true, message: 'Technician rated.', data: { job } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  ...require('../services/adminTechnicians'),
  createTechnicianJob,
  getTechnicianJobs,
  getTechnicianRequests,
  updateTechnicianRequest,
  sendTechnicianRequestMessage,
  getRequestConversation,
  updateTechnicianJob,
  deleteTechnicianJob,
  updateTechnicianJobStatus,
  unassignTechnicianJob,
  payTechnician,
  rateTechnician,
  rescheduleJob,
};
