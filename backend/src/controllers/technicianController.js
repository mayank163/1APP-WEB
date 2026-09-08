const User = require('../models/User');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const TechnicianWithdrawal = require('../models/TechnicianWithdrawal');

/**
 * Haversine formula — returns distance in metres between two GPS coordinates.
 * Returns null if any coordinate is missing or invalid.
 */
const haversineMeters = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const getJobsForTechnicians = async (req, res, next) => {
  try {
    const {
      filter = 'new',
      fromDate,
      toDate,
    } = req.query;

    const techId = req.user._id;

    let jobs = [];

    // --------------------------------
    // NEW
    // Open jobs this technician has NOT yet requested
    // --------------------------------
    if (filter === 'new') {
      jobs = await TechnicianJob.find({
        status: 'open',
        requestedBy: { $nin: [techId] },
      }).sort('-createdAt');
    }

    // --------------------------------
    // REQUESTED
    // Jobs where this technician has requested
    // --------------------------------
    else if (filter === 'requested') {
      jobs = await TechnicianJob.find({
        requestedBy: techId,
      }).sort('-createdAt');
    }

    // --------------------------------
    // ACTIVE
    // Jobs assigned to this technician that are not completed
    // --------------------------------
    else if (filter === 'active') {
      jobs = await TechnicianJob.find({
        'assignedTechnician._id': techId,
        status: {
          $in: ['assigned', 'visited', 'inprogress'],
        },
        completedAt: null,
      }).sort('-createdAt');
    }

    // --------------------------------
    // COMPLETED
    // Jobs assigned to this technician that are completed
    // --------------------------------
    else if (filter === 'completed') {
      jobs = await TechnicianJob.find({
        'assignedTechnician._id': techId,
        $or: [
          { status: 'completed' },
          { completedAt: { $ne: null } },
        ],
      }).sort('-completedAt');
    }

    // --------------------------------
    // TODAY
    // Jobs assigned to this technician today
    // Date only - ignore time
    // --------------------------------
    else if (filter === 'today') {
    const today = new Date().toISOString().split('T')[0];

    jobs = await TechnicianJob.find({
      status: { $in: ['assigned', 'inprogress'] },
      'assignedTechnician._id': techId,

      $expr: {
        $eq: [
          {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$serviceDate',
            },
          },
          today,
        ],
      },
    }).sort('serviceDate');
  }


    // --------------------------------
    // TOMORROW
    // Date only - ignore time
    // --------------------------------
    else if (filter === 'tomorrow') {

      const now = new Date();

      const tomorrow = new Date(
        now.toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
        })
      );

      tomorrow.setDate(tomorrow.getDate() + 1);

      const tomorrowDate = tomorrow.toLocaleDateString('en-CA');

      jobs = await TechnicianJob.find({
        status: 'assigned',
        'assignedTechnician._id': techId,

        $expr: {
          $eq: [
            {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$serviceDate',
                timezone: 'Asia/Kolkata',
              },
            },
            tomorrowDate,
          ],
        },
      }).sort({ serviceDate: 1 });
    }


    // --------------------------------
    // CUSTOM DATE RANGE
    // Date only - ignore time
    // --------------------------------
    else if (filter === 'custom') {

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: 'fromDate and toDate are required for custom filter',
        });
      }

      const from = fromDate.split('T')[0];
      const to = toDate.split('T')[0];

      jobs = await TechnicianJob.find({
        status: 'assigned',
        'assignedTechnician._id': techId,

        $expr: {
          $and: [
            {
              $gte: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$serviceDate',
                    timezone: 'Asia/Kolkata',
                  },
                },
                from,
              ],
            },
            {
              $lte: [
                {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$serviceDate',
                    timezone: 'Asia/Kolkata',
                  },
                },
                to,
              ],
            },
          ],
        },
      }).sort({ serviceDate: 1 });
    }

    // --------------------------------
    // INVALID FILTER
    // --------------------------------
    else {
      return res.status(400).json({
        success: false,
        message:
          'Invalid filter. Use: new, requested, active, completed, today, tomorrow, custom',
      });
    }

    // --------------------------------
    // GET REQUESTS
    // FOR CURRENT TECHNICIAN + JOBS
    // --------------------------------
    const jobIds = jobs.map((job) => job._id);

    const requests = await TechnicianJobRequest.find({
      job: { $in: jobIds },
      technician: techId,
    }).select('_id job technician status');

    // --------------------------------
    // GROUP REQUEST DATA BY JOB
    // --------------------------------
    const requestsByJob = {};

    requests.forEach((request) => {
      const jobId = request.job.toString();

      requestsByJob[jobId] = {
        requestId: request._id.toString(),
        status: request.status,
      };
    });

    // --------------------------------
    // ADD REQUEST ID + STATUS TO JOB
    // --------------------------------
    const jobsWithRequests = jobs.map((job) => {
      const jobObj = job.toObject();

      const request =
        requestsByJob[job._id.toString()];

      jobObj.requestId =
        request?.requestId || null;

      jobObj.requestStatus =
        request?.status || null;

      return jobObj;
    });

    // --------------------------------
    // RESPONSE
    // --------------------------------
    return res.status(200).json({
      success: true,
      data: {
        jobs: jobsWithRequests,
      },
    });

  } catch (error) {
    next(error);
  }
};

const requestJob = async (req, res, next) => {
  try {
    const { jobId }  = req.params;
    const note       = req.body?.note;
    const fixedPrice = req.body?.fixedPrice;  // optional — technician's proposed fixed price
    const charges    = req.body?.charges;     // optional — array of additional charges

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ success: false, message: 'This job is no longer open for requests' });
    }

    const existingRequest = await TechnicianJobRequest.findOne({
      job:       jobId,
      technician: req.user._id,
      status:    { $in: ['pending', 'accepted', 'counter-offer'] },
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already requested this job' });
    }

    const hasBid    = fixedPrice && Number(fixedPrice) > 0;
    const bidAmount = hasBid ? Number(fixedPrice) : null;
    const now       = new Date();

    // ── Build the opening conversation entry ─────────────────────────────
    const serviceDateTime = job.serviceDate
      ? new Date(job.serviceDate).toLocaleString('en-IN', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : 'scheduled time';

    const jobInfo = job.title || job.description || `Job #${job._id}`;

    // Opening message entry
    const openingEntry = note?.trim()
      ? {
          sender:    'technician',
          type:      'message',
          message:   note.trim(),
          createdAt: now,
        }
      : {
          sender:    'technician',
          type:      'message',
          message:   `Requested for ${jobInfo} on ${serviceDateTime}.`,
          createdAt: now,
        };

    const initialConversation = [openingEntry];

    // If technician proposed a fixed price, add a 'fixed_charge' entry
    if (hasBid) {
      initialConversation.push({
        sender:           'technician',
        type:             'fixed_charge',
        message:          `Proposed fixed price: ₹${bidAmount}`,
        fixedCharge:      bidAmount,
        counterOffer:     bidAmount,
        counterOfferFrom: 'technician',
        createdAt:        now,
      });
    }

    // ── Validate charges if provided ─────────────────────────────────────
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
    }

    const requestData = {
      job:              jobId,
      technician:       req.user._id,
      note:             note?.trim() || '',
      status:           'pending',
      counterOffer:     hasBid ? bidAmount : 0,
      counterOfferFrom: hasBid ? 'technician' : '',
      conversation:     initialConversation,
      ...(hasCharges && { chargesStatus: 'pending' }),
    };

    if (hasBid) requestData.bidAmount = bidAmount;

    const request = await TechnicianJobRequest.create(requestData);

    // Track technician in the job's requestedBy array
    await TechnicianJob.findByIdAndUpdate(jobId, { $addToSet: { requestedBy: req.user._id } });

    // ── Create AdditionalCharge docs with proper counterHistory ──────────
    let createdCharges = [];
    if (hasCharges) {
      const AdditionalCharge = require('../models/AdditionalCharge');

      const chargeDocs = charges.map((c) => {
        const amt = Number(c.amount);
        return {
          job:             jobId,
          request:         request._id,
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
        };
      });

      createdCharges = await AdditionalCharge.insertMany(chargeDocs);

      // Add a 'charge_submitted' conversation entry to the request
      const chargeSnapshots = createdCharges.map((ch) => ({
        chargeId:    ch._id,
        label:       ch.label,
        description: ch.description,
        amount:      ch.requestedAmount,
      }));

      await TechnicianJobRequest.findByIdAndUpdate(request._id, {
        $push: {
          conversation: {
            sender:  'technician',
            type:    'charge_submitted',
            message: `Submitted ${createdCharges.length} additional charge${createdCharges.length > 1 ? 's' : ''} for admin review.`,
            charges: chargeSnapshots,
            createdAt: now,
          },
        },
      });
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
      ? `Job request sent with ${createdCharges.length} additional charge(s)${hasBid ? ` and a fixed price of ₹${bidAmount}` : ''}`
      : hasBid
        ? `Job request sent with a proposed price of ₹${bidAmount}`
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
        withdrawals,
      },
    });
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
      return {
        ...base,
        chargeId:    entry.chargeId,
        chargeLabel: entry.chargeLabel,
        action:      entry.action,
        amount:      entry.amount,
        note:        entry.note,
      };

    case 'final_amount':
    case 'invoice_generated':
      return {
        ...base,
        fixedJobCharge:         entry.fixedJobCharge,
        additionalChargesTotal: entry.additionalChargesTotal,
        finalAmount:            entry.finalAmount,
      };

    default:
      return base;
  }
};

/**
 * GET /api/technician/requests/:requestId/conversation
 * Returns the full typed conversation timeline for a request.
 * Accessible by the owning technician.
 */
const getRequestConversation = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = await TechnicianJobRequest.findById(requestId)
      .populate('job', 'title location budget category status')
      .select('conversation status chargesStatus finalJobAmount agreedTotal agreedFixedCharge agreedAdditionalTotal technician job');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Both technician and admin (req.user.role check) can call this
    const isOwner = request.technician.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
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
        conversation,
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

    const entry = {
      sender:    'technician',
      type:      'message',
      message:   message.trim(),
      createdAt: new Date(),
    };
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

const cancelJobRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Authentication check
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const technicianId = req.user._id;

    // Find the request
    const request = await TechnicianJobRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    // Verify this request belongs to the logged-in technician
    if (
      !request.technician ||
      request.technician.toString() !== technicianId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to cancel this request',
      });
    }

    // Only pending / counter-offer requests can be cancelled
    if (!['pending', 'counter-offer'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Request cannot be cancelled because its current status is "${request.status}"`,
      });
    }

    const jobId = request.job;

    // ------------------------------------------------
    // 1. DELETE REQUEST FROM TechnicianJobRequest
    // ------------------------------------------------
    await TechnicianJobRequest.findByIdAndDelete(requestId);

    // ------------------------------------------------
    // 2. REMOVE TECHNICIAN FROM JOB.requestedBy
    // ------------------------------------------------
    await TechnicianJob.findByIdAndUpdate(
      jobId,
      {
        $pull: {
          requestedBy: technicianId,
        },
      },
      {
        new: true,
      }
    );

    // ------------------------------------------------
    // 3. SOCKET NOTIFICATION
    // ------------------------------------------------
    try {
      const { getIO } = require('../utils/socketInstance');

      getIO()
        .to('admin')
        .emit('job:request:cancelled', {
          requestId,
          jobId,
          technicianId,
        });

      console.log(
        `[Socket] Technician cancelled request="${requestId}"`
      );
    } catch (socketError) {
      console.warn(
        '[Socket] cancelJobRequest socket failed:',
        socketError.message
      );
    }

    // ------------------------------------------------
    // RESPONSE
    // ------------------------------------------------
    return res.status(200).json({
      success: true,
      message: 'Job request cancelled and removed successfully',
      data: {
        requestId,
        jobId,
        technicianId,
      },
    });

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

    // Get all requests with job populated
    const requests = await TechnicianJobRequest.find({
      technician: req.user._id,
    })
      .populate('job')
      .sort({ createdAt: -1 });

    // Request counts
    const acceptedCount = requests.filter(
      (r) => r.status === 'accepted'
    ).length;

    const pendingCount = requests.filter(
      (r) => r.status === 'pending'
    ).length;

    // =====================================
    // EXTRACT MY JOBS
    // Same logic as attached frontend file
    // =====================================
    const myJobs = requests
      .filter((request) => request.status === 'accepted' && request.job)
      .map((request) => request.job);

    // =====================================
    // ACTIVE JOBS
    // Jobs that are assigned (accepted) but NOT completed yet
    // =====================================
    const activeJobs = myJobs.filter(
      (job) => job.status !== 'completed'
    ).length;

    // =====================================
    // TODAY'S SCHEDULE
    // Compare DATE only, ignore TIME
    // Exclude completed jobs
    // =====================================

    const today = new Date().toISOString().split('T')[0];

    const todaySchedule = myJobs.filter((job) => {

      // Exclude completed jobs
      if (job.status === 'completed' || job.completedAt) {
        return false;
      }

      // No service date
      if (!job.serviceDate) {
        return false;
      }

      // Extract only YYYY-MM-DD
      const serviceDate = new Date(job.serviceDate)
        .toISOString()
        .split('T')[0];

      return serviceDate === today;

    }).length;

    // =====================================
    // TOTAL REQUESTS
    // =====================================
    const totalRequests = requests.length;

    // =====================================
    // RESPONSE
    // =====================================
    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalJobsDone: technician.totalJobsDone || 0,
          totalEarnings: technician.totalEarnings || 0,
          totalWithdrawn: technician.totalWithdrawn || 0,

          availableBalance: Math.max(
            (technician.totalEarnings || 0) -
              (technician.totalWithdrawn || 0),
            0
          ),

          acceptedCount,
          pendingCount,
          activeJobs, // Now correctly counts assigned but not completed jobs
          todaySchedule,
          totalRequests,
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
 * @body  { lat?: number, lng?: number }
 */
const markReached = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { lat, lng } = req.body || {};

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
    job.status = 'inprogress';

    // Store GPS coordinates if provided
    const hasLocation = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));

    // Distance between technician's position and the job's pinned location
    const distMeters = hasLocation
      ? haversineMeters(Number(lat), Number(lng), job.coordinates?.lat, job.coordinates?.lng)
      : null;

    // Write everything into reachedStatus
    if (hasLocation) {
      job.reachedStatus = {
        at:             now,
        lat:            Number(lat),
        lng:            Number(lng),
        distanceMeters: distMeters,
      };
    }

    const distNote = distMeters !== null
      ? ` Distance from job site: ${distMeters >= 1000 ? (distMeters / 1000).toFixed(2) + ' km' : distMeters + ' m'}.`
      : '';
    const locationNote = hasLocation
      ? ` (GPS: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)})${distNote}`
      : '';

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'technician',
      message: `Technician reached the location at ${now.toLocaleString('en-IN')}.${locationNote}`,
      createdAt: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Reached location recorded',
      data: {
        reachedAt:     job.reachedAt,
        jobStartedAt:  job.jobStartedAt,
        status:        job.status,
        reachedStatus: job.reachedStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc  Technician presses "Job Completed" button
 * @route PATCH /api/technician/jobs/:jobId/complete
 * @body  { lat?: number, lng?: number }
 */
const markJobCompleted = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { lat, lng } = req.body || {};

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

    // Store GPS coordinates if provided
    const hasLocation = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));

    // Distance between technician's position and the job's pinned location
    const distMeters = hasLocation
      ? haversineMeters(Number(lat), Number(lng), job.coordinates?.lat, job.coordinates?.lng)
      : null;

    // Write everything into completedStatus
    if (hasLocation) {
      job.completedStatus = {
        at:             now,
        lat:            Number(lat),
        lng:            Number(lng),
        distanceMeters: distMeters,
      };
    }

    const distNote = distMeters !== null
      ? ` Distance from job site: ${distMeters >= 1000 ? (distMeters / 1000).toFixed(2) + ' km' : distMeters + ' m'}.`
      : '';
    const locationNote = hasLocation
      ? ` (GPS: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)})${distNote}`
      : '';

    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'technician',
      message: `Technician marked job as completed at ${now.toLocaleString('en-IN')}.${job.jobDurationMinutes != null ? ` Duration: ${job.jobDurationMinutes} min.` : ''}${locationNote}`,
      createdAt: now,
    });

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job completion recorded. Waiting for admin to close and process payment.',
      data: {
        jobCompletedAt:     job.jobCompletedAt,
        jobDurationMinutes: job.jobDurationMinutes,
        reachedAt:          job.reachedAt,
        completedStatus:    job.completedStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// const counterOffer = async (req, res, next) => {
//   try {
//     const { requestId } = req.params;
//     const { amount, message } = req.body;

//     if (!amount || Number(amount) <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide a valid counter offer amount',
//       });
//     }

//     const request = await TechnicianJobRequest.findById(requestId);

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: 'Request not found',
//       });
//     }

//     // Make sure this request belongs to logged-in technician
//     if (request.technician.toString() !== req.user._id.toString()) {
//       return res.status(403).json({
//         success: false,
//         message: 'You are not allowed to modify this request',
//       });
//     }

//     // Don't allow negotiation after accepted/rejected
//     if (['accepted', 'rejected'].includes(request.status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'This request is no longer available for negotiation',
//       });
//     }

//     const now = new Date();
//     const offerAmount = Number(amount);

//     request.status = 'counter-offer';
//     request.counterOffer = offerAmount;
//     request.counterOfferFrom = 'technician';

//     const trimmedMessage = message && message.trim();
//     if (trimmedMessage) {
//       request.adminMessage = trimmedMessage;
//     }

//     request.conversation = request.conversation || [];

//     request.conversation.push({
//       sender: 'technician',
//       message: trimmedMessage ? `Counter offer: ₹${offerAmount}. ${trimmedMessage}` : `Counter offer: ₹${offerAmount}.`,
//       counterOffer: offerAmount,
//       counterOfferFrom: 'technician',
//       createdAt: now,
//     });

//     await request.save();

//     // Socket.IO
//     try {
//       const { getIO } = require('../utils/socketInstance');

//       getIO()
//         .to(`request:${requestId}`)
//         .emit('request:message', {
//           requestId,
//           message: request.conversation[
//             request.conversation.length - 1
//           ],
//         });
//       console.log(`[Socket] emitToRequest → room="request:${requestId}" event="request:message"`);

//       getIO()
//         .to(`request:${requestId}`)
//         .emit('request:status', {
//           requestId,
//           status: request.status,
//           counterOffer: request.counterOffer,
//           counterOfferFrom: request.counterOfferFrom,
//         });
//       console.log(`[Socket] emitToRequest → room="request:${requestId}" event="request:status" status="${request.status}"`);
//     } catch (error) {
//       // Socket should not break API
//       console.warn('[Socket] emit failed in counterOffer:', error.message);
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Counter offer sent',
//       data: {
//         request,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const getWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await TechnicianWithdrawal.find({ technician: req.user._id }).sort('-createdAt');
    res.status(200).json({ success: true, data: { withdrawals } });
  } catch (error) {
    next(error);
  }
};

// const getMyJobs = async (req, res, next) => {
//   try {
//     const { filter, fromDate, toDate, search } = req.query;

//     // --------------------------------
//     // GET TECHNICIAN JOB REQUESTS
//     // --------------------------------

//     const requestQuery = {
//       technician: req.user._id,
//     };

//     // Requested jobs
//     if (filter === 'requested') {
//       requestQuery.status = 'pending';
//     } else {
//       // My jobs = accepted jobs
//       requestQuery.status = 'accepted';
//     }

//     const requests = await TechnicianJobRequest.find(requestQuery)
//       .populate('job')
//       .sort({ createdAt: -1 });

//     let myJobs = requests
//       .filter((request) => request.job)
//       .map((request) => request.job);

//     // --------------------------------
//     // ACTIVE JOBS
//     // --------------------------------

//     if (filter === 'active') {
//       myJobs = myJobs.filter((job) => {
//         return !job.completedAt;
//       });
//     }  

//     // --------------------------------
//     // COMPLETED JOBS
//     //GET /api/technician/my-jobs?filter=completed
//     // --------------------------------

//     if (filter === 'completed') {
//       myJobs = myJobs.filter((job) => job.completedAt);
//     }

//     // --------------------------------
//     // TODAY / YESTERDAY / TOMORROW
//     // --------------------------------

//     if (['today', 'yesterday', 'tomorrow'].includes(filter)) {
//       const startDate = new Date();

//       if (filter === 'yesterday') {
//         startDate.setDate(startDate.getDate() - 1);
//       }

//       if (filter === 'tomorrow') {
//         startDate.setDate(startDate.getDate() + 1);
//       }

//       startDate.setHours(0, 0, 0, 0);

//       const endDate = new Date(startDate);
//       endDate.setHours(23, 59, 59, 999);

//       myJobs = myJobs.filter((job) => {
//         if (!job.scheduledDate) {
//           return false;
//         }

//         const scheduledDate = new Date(job.scheduledDate);

//         return (
//           scheduledDate >= startDate &&
//           scheduledDate <= endDate
//         );
//       });
//     }

//     // --------------------------------
//     // CUSTOM DATE RANGE
//     // --------------------------------

//     if (fromDate || toDate) {
//       myJobs = myJobs.filter((job) => {
//         if (!job.scheduledDate) {
//           return false;
//         }

//         const scheduledDate = new Date(job.scheduledDate);

//         if (fromDate) {
//           const startDate = new Date(fromDate);
//           startDate.setHours(0, 0, 0, 0);

//           if (scheduledDate < startDate) {
//             return false;
//           }
//         }

//         if (toDate) {
//           const endDate = new Date(toDate);
//           endDate.setHours(23, 59, 59, 999);

//           if (scheduledDate > endDate) {
//             return false;
//           }
//         }

//         return true;
//       });
//     }

//     // --------------------------------
//     // SEARCH
//     // --------------------------------

//     if (search) {
//       const searchText = search.trim().toLowerCase();

//       myJobs = myJobs.filter((job) => {
//         return (
//           job.title?.toLowerCase().includes(searchText) ||
//           job.category?.toLowerCase().includes(searchText) ||
//           job.description?.toLowerCase().includes(searchText) ||
//           job.location?.toLowerCase().includes(searchText)
//         );
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         jobs: myJobs,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

/**
 * PATCH /api/technician/jobs/:jobId/tasks/:taskIndex/complete
 * Body: { lat?, lng? }
 */
const completeTask = async (req, res, next) => {
  try {
    const { jobId, taskIndex } = req.params;
    const { lat, lng } = req.body || {};

    const job = await TechnicianJob.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    if (!job.assignedTechnician?._id ||
        job.assignedTechnician._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this job' });
    }

    const idx = Number(taskIndex);
    if (isNaN(idx) || idx < 0 || idx >= job.tasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid task index' });
    }

    const task = job.tasks[idx];
    if (task.isDone) {
      return res.status(400).json({ success: false, message: 'Task already completed' });
    }

    const hasLocation = lat != null && lng != null &&
                        !isNaN(Number(lat)) && !isNaN(Number(lng));
    const distMeters  = hasLocation
      ? haversineMeters(Number(lat), Number(lng), job.coordinates?.lat, job.coordinates?.lng)
      : null;

    task.isDone         = true;
    task.checkedAt      = new Date();
    task.technicianLat  = hasLocation ? Number(lat) : null;
    task.technicianLng  = hasLocation ? Number(lng) : null;
    task.distanceMeters = distMeters;

    job.markModified('tasks');
    await job.save();

    try {
      const { getIO } = require('../utils/socketInstance');
      getIO().to('admin').emit('job:task:completed', { jobId, taskIndex: idx, task: job.tasks[idx] });
    } catch (e) {
      console.warn('[Socket] job:task:completed emit failed:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Task marked as completed',
      data: { task: job.tasks[idx] },
    });
  } catch (error) {
    next(error);
  }
};

const getDetailsByJobId = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Get complete job details
    const job = await TechnicianJob.findById(jobId)
      .populate('assignedTechnician', 'name email phone skills experienceLevel');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        job
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobsForTechnicians,
  requestJob,
  cancelJobRequest,
  getMyRequests,
  getTechnicianDashboard,
  createWithdrawalRequest,
  getWithdrawals,
  updateRequestStatus,
  getMetrics,
  markReached,
  markJobCompleted,
  // counterOffer,
  sendMessageOnRequest,
  getRequestMessages,
  getRequestConversation,
  // getMyJobs,
  getDetailsByJobId,
  completeTask,
};
