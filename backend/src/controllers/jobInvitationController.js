const mongoose = require('mongoose');
const Job = require('../models/TechnicianJob');
const Request = require('../models/TechnicianJobRequest');
const User = require('../models/User');
const { getIO } = require('../utils/socketInstance');
const error = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const activeTechnician = user => user?.role === 'technician' && !['invited', 'suspended', 'blocked'].includes(user.accountStatus);
const openJob = job => job && job.status === 'open' && !job.assignedTechnician?._id && !job.assignedRequest;
const baseAmount = (pay = {}) => {
  if (typeof pay === 'number') return pay;
  if (!pay || typeof pay !== 'object') return 0;
  switch (pay.type) {
    case 'hourly': return (pay.hourlyRate || 0) * (pay.maxHours || 0);
    case 'perDevice': return (pay.perDeviceRate || 0) * (pay.maxDevices || 0);
    case 'blended': return (pay.blendedFixedAmount || 0) + (pay.blendedHourlyRate || 0) * (pay.blendedMaxAddlHours || 0);
    default: return pay.fixedAmount || 0;
  }
};
const notify = async (requestId, technicianId, job) => {
  try {
    const request = await Request.findById(requestId).populate('job technician');
    const io = getIO();
    io.to('admin').emit('request:updated', { request });
    io.to(`technician:${technicianId}`).emit('job:invitation', { requestId });
    if (job) {
      io.to('admin').emit('job:updated', { job });
      io.emit('job:availability', { jobId: String(job._id), status: job.status });
    }
  } catch (err) { console.warn('Invitation notification failed:', err.message); }
};

exports.sendInvitation = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { technicianId, message = '' } = req.body;
    if (!mongoose.isValidObjectId(jobId) || !mongoose.isValidObjectId(technicianId) || typeof message !== 'string' || message.length > 2000) {
      throw error('Select a valid job and technician. Messages may contain up to 2000 characters.', 400);
    }
    let invitation;
    await mongoose.connection.transaction(async session => {
      const job = await Job.findById(jobId).session(session);
      const technician = await User.findById(technicianId).session(session);
      if (!job) throw error('Job not found.', 404);
      if (!openJob(job)) throw error('Only open, unassigned jobs can receive invitations.');
      if (!activeTechnician(technician)) throw error('Select an active technician.', 400);
      if (await Request.findOne({ job: jobId, technician: technicianId, initiatedBy: 'admin' }).session(session)) throw error('This technician has already been invited to this job.');
      // Lock against assignment during invitation creation, without assigning the job.
      const available = await Job.updateOne({ _id: jobId, status: 'open', 'assignedTechnician._id': null, assignedRequest: null }, { $inc: { __v: 1 } }, { session });
      if (!available.matchedCount) throw error('This job is no longer available.');
      [invitation] = await Request.create([{
        job: jobId, technician: technicianId, initiatedBy: 'admin', invitedBy: req.user._id,
        status: 'pending',
        offeredPay: job.pay || { type: 'fixed', fixedAmount: 0 },
        adminMessage: message.trim(),
        conversation: [{ sender: 'admin', message: message.trim() || 'You are invited to this job. Please accept or reject the invitation.' }],
      }], { session });
    });
    await notify(invitation._id, technicianId);
    res.status(201).json({ success: true, message: 'Request sent. Assignment is pending technician acceptance.', data: { request: invitation } });
  } catch (err) { next(err.code === 11000 ? error('This technician has already been invited to this job.') : err); }
};

exports.respondToInvitation = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action) || !mongoose.isValidObjectId(req.params.requestId)) throw error('Choose accept or reject for a valid invitation.', 400);
    let invitation, assignedJob;
    await mongoose.connection.transaction(async session => {
      invitation = await Request.findOne({ _id: req.params.requestId, technician: req.user._id, initiatedBy: 'admin' }).session(session);
      if (!invitation) throw error('Invitation not found.', 404);
      if (invitation.status !== 'pending') throw error('This invitation has already been answered or is no longer available.');
      const technician = await User.findById(req.user._id).session(session);
      if (!activeTechnician(technician)) throw error('Your technician account is not active.', 403);
      const now = new Date();
      if (action === 'accept') {
        const amount = baseAmount(invitation.offeredPay);
        assignedJob = await Job.findOneAndUpdate({ _id: invitation.job, status: 'open', 'assignedTechnician._id': null, assignedRequest: null }, {
          $set: { status: 'assigned', assignedRequest: invitation._id, assignedTechnician: { _id: technician._id, name: technician.name, email: technician.email, phone: technician.phone }, finalPrice: amount },
          $push: { statusHistory: { status: 'assigned', note: 'Technician accepted the admin invitation.', changedAt: now }, conversation: { sender: 'system', message: `${technician.name} accepted the invitation and was assigned.`, createdAt: now } },
        }, { session, new: true, runValidators: true });
        if (!assignedJob) throw error('This job has already been assigned or is no longer open.');
        invitation.paymentStatus = 'pending';
        invitation.agreedFixedCharge = amount;
        invitation.agreedAdditionalTotal = 0;
        invitation.agreedTotal = amount;
        invitation.finalJobAmount = amount;
        await Request.updateMany({ job: invitation.job, _id: { $ne: invitation._id }, status: { $in: ['pending', 'counter-offer'] } }, {
          $set: { status: 'rejected', adminMessage: 'This job has been assigned; this request is now closed.' },
          $push: { conversation: { sender: 'system', message: 'This job has been assigned; this request is now closed.', createdAt: now } },
        }, { session });
      }
      invitation.status = action === 'accept' ? 'accepted' : 'rejected';
      invitation.respondedAt = now;
      invitation.conversation.push({ sender: 'technician', message: action === 'accept' ? 'I accepted the job invitation.' : 'I declined the job invitation.', createdAt: now });
      await invitation.save({ session });
    });
    await notify(invitation._id, req.user._id, assignedJob);
    res.json({ success: true, message: action === 'accept' ? 'Invitation accepted. The job is assigned to you.' : 'Invitation rejected.', data: { request: invitation, job: assignedJob } });
  } catch (err) { next(err); }
};
exports.baseAmount = baseAmount;
