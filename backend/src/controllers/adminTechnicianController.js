const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const User = require('../models/User');
const { getIO } = require('../utils/socketInstance');

// Safely emit to a request-scoped room (never throws if io not ready)
const emitToRequest = (requestId, event, payload) => {
  try { getIO().to(`request:${requestId}`).emit(event, payload); } catch (_) {}
};

// Safely emit to the admin room (never throws if io not ready)
const emitToAdmin = (event, payload) => {
  try { getIO().to('admin').emit(event, payload); } catch (_) {}
};

const createTechnicianJob = async (req, res, next) => {
  try {
    const { title, category, location, budget, description, requirements, serviceDate, preferredSkills, estimatedTime } = req.body;

    if (!title || !location || !budget || !description) {
      return res.status(400).json({ success: false, message: 'Please provide all required job fields' });
    }

    const job = await TechnicianJob.create({
      title,
      category: category || 'General Service',
      location,
      budget: Number(budget),
      description,
      requirements: Array.isArray(requirements) ? requirements : [],
      postedBy: req.user._id,
      serviceDate: serviceDate ? new Date(serviceDate) : null,
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      estimatedTime: estimatedTime || '',
    });

    res.status(201).json({ success: true, message: 'Job posted successfully', data: { job } });
    emitToAdmin('job:created', { job });
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

    if (!['accepted', 'rejected', 'counter-offer'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid request status' });
    }

    const request = await TechnicianJobRequest.findById(requestId).populate('technician job');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = status;
    request.adminMessage = adminMessage || '';
    request.counterOfferFrom = 'admin';
    if (counterOffer !== undefined) request.counterOffer = Number(counterOffer || 0);

    const conversationMessage = adminMessage || (status === 'accepted' ? 'Request accepted.' : status === 'rejected' ? 'Request rejected.' : `Counter offer sent: $${Number(counterOffer || 0)}`);
    request.conversation = request.conversation || [];
    request.conversation.push({
      sender: 'admin',
      message: conversationMessage,
      counterOffer: status === 'counter-offer' ? Number(counterOffer || 0) : 0,
      counterOfferFrom: status === 'counter-offer' ? 'admin' : '',
      createdAt: new Date(),
    });

    if (status === 'accepted') {
      const job = await TechnicianJob.findById(request.job._id || request.job);
      const technician = await User.findById(request.technician._id || request.technician);

      if (job) {
        job.status = 'assigned';
        job.assignedTechnician = {
          _id: technician._id,
          name: technician.name,
          email: technician.email,
          phone: technician.phone,
        };
        job.assignedRequest = request._id;
        job.conversation = job.conversation || [];
        job.conversation.push({
          sender: 'admin',
          message: `${technician.name} has been assigned to this job.`,
          createdAt: new Date(),
        });
        await job.save();
      }

      request.completedAt = null;
      request.paymentStatus = 'pending';
      request.amountEarned = 0;
    }

    if (status === 'counter-offer') {
      request.counterOffer = Number(counterOffer || 0);
    }

    await request.save();

    // Real-time: notify everyone in this request's room
    const newMsg = request.conversation[request.conversation.length - 1];
    emitToRequest(requestId, 'request:message', {
      requestId,
      message: newMsg,
    });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: request.status,
    });

    res.status(200).json({ success: true, message: 'Request status updated', data: { request } });
    emitToAdmin('request:updated', { request });
  } catch (error) {
    next(error);
  }
};

const updateTechnicianJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { title, category, location, budget, description, requirements, serviceDate, preferredSkills, estimatedTime } = req.body;

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (title) job.title = title;
    if (category) job.category = category;
    if (location) job.location = location;
    if (budget !== undefined) job.budget = Number(budget || 0);
    if (description) job.description = description;
    if (serviceDate !== undefined) job.serviceDate = serviceDate ? new Date(serviceDate) : null;
    if (Array.isArray(requirements)) job.requirements = requirements;
    if (Array.isArray(preferredSkills)) job.preferredSkills = preferredSkills;
    if (estimatedTime !== undefined) job.estimatedTime = estimatedTime || '';

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

    const validStatuses = ['open', 'assigned', 'visited', 'in-progress', 'completed', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid job status' });
    }

    const job = await TechnicianJob.findById(jobId).populate('assignedRequest');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    job.status = status;
    if (note) {
      job.conversation = job.conversation || [];
      job.conversation.push({ sender: 'admin', message: note, createdAt: new Date() });
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
    const offerAmount = Number(counterOffer || 0);

    if (!trimmedMessage && offerAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const request = await TechnicianJobRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (offerAmount > 0) {
      request.status = 'counter-offer';
      request.counterOffer = offerAmount;
      request.counterOfferFrom = 'admin';
      request.adminMessage = trimmedMessage || `Counter offer sent: $${offerAmount}`;
    } else if (trimmedMessage) {
      request.adminMessage = trimmedMessage;
    }

    request.conversation = request.conversation || [];
    request.conversation.push({
      sender: 'admin',
      message: trimmedMessage || `Counter offer sent: $${offerAmount}`,
      counterOffer: offerAmount,
      counterOfferFrom: offerAmount > 0 ? (counterOfferFrom || 'admin') : '',
      createdAt: new Date(),
    });

    await request.save();

    const newMsg = request.conversation[request.conversation.length - 1];
    emitToRequest(requestId, 'request:message', {
      requestId,
      message: newMsg,
    });
    emitToRequest(requestId, 'request:status', {
      requestId,
      status: request.status,
      counterOffer: request.counterOffer,
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
    const { scheduledDate, reason } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: 'Please provide a new scheduled date' });
    }

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const newDate = new Date(scheduledDate);
    if (isNaN(newDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    job.rescheduleHistory = job.rescheduleHistory || [];
    job.rescheduleHistory.push({
      previousDate: job.scheduledDate || null,
      newDate,
      reason: reason || '',
      rescheduledAt: new Date(),
    });

    job.scheduledDate = newDate;
    job.serviceDate = newDate;
    job.conversation = job.conversation || [];
    job.conversation.push({
      sender: 'admin',
      message: `Job rescheduled to ${newDate.toLocaleString('en-IN')}${reason ? `. Reason: ${reason}` : ''}.`,
      createdAt: new Date(),
    });

    await job.save();

    res.status(200).json({ success: true, message: 'Job rescheduled successfully', data: { job } });
    emitToAdmin('job:updated', { job });
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
  updateTechnicianJob,
  deleteTechnicianJob,
  updateTechnicianJobStatus,
  payTechnicianWallet,
  rescheduleJob,
};
