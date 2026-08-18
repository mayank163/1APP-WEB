const User = require('../models/User');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const TechnicianWithdrawal = require('../models/TechnicianWithdrawal');

const getJobsForTechnicians = async (req, res, next) => {
  try {
    const jobs = await TechnicianJob.find({ status: 'open' }).sort('-createdAt');
    res.status(200).json({ success: true, data: { jobs } });
  } catch (error) {
    next(error);
  }
};

const requestJob = async (req, res, next) => {
  try {
    const { jobId }    = req.params;
    const note         = req.body?.note;
    const fixedPrice   = req.body?.fixedPrice;   // optional — technician's proposed fixed price
    const charges      = req.body?.charges;       // optional — array of additional charges

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: 'This job is no longer open for requests' });
    }

    const existingRequest = await TechnicianJobRequest.findOne({
      job: jobId,
      technician: req.user._id,
      status: { $in: ['pending', 'accepted', 'counter-offer'] },
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already requested this job' });
    }

    // Determine if technician is proposing a different fixed price
    const hasBid     = fixedPrice && Number(fixedPrice) > 0;
    const bidAmount  = hasBid ? Number(fixedPrice) : null;

    // Build opening conversation message
    const parts = [];
    if (note?.trim()) parts.push(note.trim());
    if (hasBid) parts.push(`Proposed fixed price: $${bidAmount.toLocaleString()}`);

    const requestData = {
      job:             jobId,
      technician:      req.user._id,
      note:            note?.trim() || '',
      status:          'pending',
      counterOffer:    hasBid ? bidAmount : 0,
      counterOfferFrom: hasBid ? 'technician' : '',
      conversation: [{
        sender:          'technician',
        message:         parts.length ? parts.join('. ') : 'Job request submitted.',
        counterOffer:    hasBid ? bidAmount : 0,
        counterOfferFrom: hasBid ? 'technician' : '',
        createdAt:       new Date(),
      }],
    };

    if (hasBid) requestData.bidAmount = bidAmount;

    // Validate charges if provided
    const hasCharges = Array.isArray(charges) && charges.length > 0;
    if (hasCharges) {
      for (const c of charges) {
        if (!c.label?.trim()) {
          return res.status(400).json({ success: false, message: 'Each charge must have a label' });
        }
        if (!c.amount || Number(c.amount) <= 0) {
          return res.status(400).json({ success: false, message: `Amount for "${c.label}" must be > 0` });
        }
      }
      requestData.chargesStatus = 'pending';
    }

    const request = await TechnicianJobRequest.create(requestData);

    // Create AdditionalCharge docs if charges were provided
    let createdCharges = [];
    if (hasCharges) {
      const AdditionalCharge = require('../models/AdditionalCharge');
      createdCharges = await AdditionalCharge.insertMany(
        charges.map((c) => ({
          job:             jobId,
          request:         request._id,
          technician:      req.user._id,
          label:           c.label.trim(),
          description:     c.description ? c.description.trim() : '',
          requestedAmount: Number(c.amount),
          status:          'pending',
          submittedAt:     new Date(),
        }))
      );
    }

    // Notify admin
    try {
      const { getIO } = require('../utils/socketInstance');
      getIO().to('admin').emit('job:request:new', { jobId, request, charges: createdCharges });
      console.log(`[Socket] emitToAdmin → room="admin" event="job:request:new" jobId="${jobId}" requestId="${request._id}"`);
    } catch (e) {
      console.warn('[Socket] emitToAdmin failed for event "job:request:new":', e.message);
    }

    const msg = hasCharges
      ? `Job request sent with ${createdCharges.length} additional charge(s)${hasBid ? ` and a fixed price of $${bidAmount}` : ''}`
      : hasBid
        ? `Job request sent with a proposed price of $${bidAmount}`
        : 'Job request sent';

    res.status(201).json({
      success: true,
      message: msg,
      data: { request, charges: createdCharges },
    });
  } catch (error) {
    next(error);
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const requests = await TechnicianJobRequest.find({ technician: req.user._id })
      .populate('job')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: { requests } });
  } catch (error) {
    next(error);
  }
};

const getTechnicianDashboard = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);
    const requests = await TechnicianJobRequest.find({ technician: req.user._id }).populate('job');
    const withdrawals = await TechnicianWithdrawal.find({ technician: req.user._id }).sort('-createdAt');

    const totalJobsDone = technician.totalJobsDone || 0;
    const totalEarnings = technician.totalEarnings || 0;
    const totalWithdrawn = technician.totalWithdrawn || 0;
    const availableBalance = Math.max(totalEarnings - totalWithdrawn, 0);

    res.status(200).json({
      success: true,
      data: {
        technician: {
          name: technician.name,
          email: technician.email,
          phone: technician.phone,
          skills: technician.skills || [],
          experienceLevel: technician.experienceLevel || 'Beginner',
          totalJobsDone,
          totalEarnings,
          totalWithdrawn,
          availableBalance,
          profileCompleted: technician.profileCompleted || false,
        },
        requests,
        withdrawals,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createWithdrawalRequest = async (req, res, next) => {
  try {
    const { amount, method, details } = req.body;
    const technician = await User.findById(req.user._id);
    const available = Math.max((technician.totalEarnings || 0) - (technician.totalWithdrawn || 0), 0);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid withdrawal amount' });
    }

    if (amount > available) {
      return res.status(400).json({ success: false, message: 'Withdrawal amount exceeds available balance' });
    }

    const withdrawal = await TechnicianWithdrawal.create({
      technician: req.user._id,
      amount,
      method: method || 'bank-transfer',
      details: details || '',
      status: 'pending',
    });

    res.status(201).json({ success: true, message: 'Withdrawal requested', data: { withdrawal } });
  } catch (error) {
    next(error);
  }
};

const sendMessageOnRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const request = await TechnicianJobRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const entry = { sender: 'technician', message: message.trim(), createdAt: new Date() };
    request.conversation = request.conversation || [];
    request.conversation.push(entry);
    await request.save();

    try {
      const { getIO } = require('../utils/socketInstance');
      getIO().to(`request:${requestId}`).emit('request:message', { requestId, message: entry });
      console.log(`[Socket] emitToRequest → room="request:${requestId}" event="request:message"`);
    } catch (e) {
      console.warn('[Socket] emitToRequest failed for event "request:message":', e.message);
    }

    res.status(200).json({ success: true, message: 'Message sent', data: { entry } });
  } catch (error) {
    next(error);
  }
};

const getRequestMessages = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = await TechnicianJobRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    res.status(200).json({ success: true, data: { conversation: request.conversation || [] } });
  } catch (error) {
    next(error);
  }
};


const updateRequestStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, adminMessage, counterOffer } = req.body;

    const request = await TechnicianJobRequest.findById(requestId).populate('technician job');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const allowed = ['accepted', 'rejected', 'counter-offer'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status update' });
    }

    request.status = status;
    if (adminMessage) request.adminMessage = adminMessage;
    if (counterOffer !== undefined) request.counterOffer = Number(counterOffer || 0);

    if (status === 'accepted') {
      request.completedAt = new Date();
      const technician = await User.findById(request.technician);
      const jobValue = request.job?.budget || 0;
      technician.totalEarnings = (technician.totalEarnings || 0) + jobValue;
      technician.totalJobsDone = (technician.totalJobsDone || 0) + 1;
      await technician.save();
    }

    await request.save();

    res.status(200).json({ success: true, message: 'Request updated', data: { request } });
  } catch (error) {
    next(error);
  }
};

const getMetrics = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);
    const requests = await TechnicianJobRequest.find({ technician: req.user._id });
    const acceptedCount = requests.filter(r => r.status === 'accepted').length;
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalJobsDone: technician.totalJobsDone || 0,
          totalEarnings: technician.totalEarnings || 0,
          totalWithdrawn: technician.totalWithdrawn || 0,
          availableBalance: Math.max((technician.totalEarnings || 0) - (technician.totalWithdrawn || 0), 0),
          acceptedCount,
          pendingCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc  Technician presses "I have reached the location" button
 * @route PATCH /api/technician/jobs/:jobId/reached
 */
const markReached = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Only the assigned technician can mark reached
    if (!job.assignedTechnician?._id || job.assignedTechnician._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this job' });
    }

    if (job.reachedAt) {
      return res.status(400).json({ success: false, message: 'Location already marked as reached' });
    }

    const now = new Date();
    job.reachedAt = now;
    job.jobStartedAt = now;
    job.status = 'in-progress';

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'technician',
      message: `Technician reached the location at ${now.toLocaleString('en-IN')}.`,
      createdAt: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Reached location recorded',
      data: { reachedAt: job.reachedAt, jobStartedAt: job.jobStartedAt, status: job.status },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc  Technician presses "Job Completed" button
 * @route PATCH /api/technician/jobs/:jobId/complete
 */
const markJobCompleted = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Only the assigned technician can mark completed
    if (!job.assignedTechnician?._id || job.assignedTechnician._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this job' });
    }

    if (job.jobCompletedAt) {
      return res.status(400).json({ success: false, message: 'Job already marked as completed' });
    }

    const now = new Date();
    job.jobCompletedAt = now;

    // Calculate duration from reachedAt or jobStartedAt
    const startRef = job.jobStartedAt || job.reachedAt;
    if (startRef) {
      const diffMs = now - new Date(startRef);
      job.jobDurationMinutes = Math.round(diffMs / 60000);
    }

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'technician',
      message: `Technician marked job as completed at ${now.toLocaleString('en-IN')}.${job.jobDurationMinutes != null ? ` Duration: ${job.jobDurationMinutes} min.` : ''}`,
      createdAt: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job completion recorded. Waiting for admin to close and process payment.',
      data: {
        jobCompletedAt: job.jobCompletedAt,
        jobDurationMinutes: job.jobDurationMinutes,
        reachedAt: job.reachedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const counterOffer = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { amount, message } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid counter offer amount',
      });
    }

    const request = await TechnicianJobRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    // Make sure this request belongs to logged-in technician
    if (request.technician.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to modify this request',
      });
    }

    // Don't allow negotiation after accepted/rejected
    if (['accepted', 'rejected'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: 'This request is no longer available for negotiation',
      });
    }

    const now = new Date();
    const offerAmount = Number(amount);

    request.status = 'counter-offer';
    request.counterOffer = offerAmount;
    request.counterOfferFrom = 'technician';

    const trimmedMessage = message && message.trim();
    if (trimmedMessage) {
      request.adminMessage = trimmedMessage;
    }

    request.conversation = request.conversation || [];

    request.conversation.push({
      sender: 'technician',
      message: trimmedMessage ? `Counter offer: ₹${offerAmount}. ${trimmedMessage}` : `Counter offer: ₹${offerAmount}.`,
      counterOffer: offerAmount,
      counterOfferFrom: 'technician',
      createdAt: now,
    });

    await request.save();

    // Socket.IO
    try {
      const { getIO } = require('../utils/socketInstance');

      getIO()
        .to(`request:${requestId}`)
        .emit('request:message', {
          requestId,
          message: request.conversation[
            request.conversation.length - 1
          ],
        });
      console.log(`[Socket] emitToRequest → room="request:${requestId}" event="request:message"`);

      getIO()
        .to(`request:${requestId}`)
        .emit('request:status', {
          requestId,
          status: request.status,
          counterOffer: request.counterOffer,
          counterOfferFrom: request.counterOfferFrom,
        });
      console.log(`[Socket] emitToRequest → room="request:${requestId}" event="request:status" status="${request.status}"`);
    } catch (error) {
      // Socket should not break API
      console.warn('[Socket] emit failed in counterOffer:', error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Counter offer sent',
      data: {
        request,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await TechnicianWithdrawal.find({ technician: req.user._id }).sort('-createdAt');
    res.status(200).json({ success: true, data: { withdrawals } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobsForTechnicians,
  requestJob,
  getMyRequests,
  getTechnicianDashboard,
  createWithdrawalRequest,
  getWithdrawals,
  updateRequestStatus,
  getMetrics,
  markReached,
  markJobCompleted,
  counterOffer,
  sendMessageOnRequest,
  getRequestMessages,
};
