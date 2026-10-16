const mongoose = require('mongoose');
const Job = require('../models/TechnicianJob');
const Request = require('../models/TechnicianJobRequest');
const User = require('../models/User');
const { getIO } = require('../utils/socketInstance');
const sendNotification = require('../services/notificationService');
const { syncBookingFromTechnicianJob } = require('../services/bookingTechnicianJobSync');
const error = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const activeTechnician = user => user?.role === 'technician' && isRoutableAccount(user);
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

const { rankTechnicians, ROUTABLE_ACCOUNT_STATUSES, isRoutableAccount } = require('../services/technicianRouting');
const { COMPLETED_STATUSES } = require('../services/technicianWorkSummary');

const routingCandidates = async (job, session = null) => {
  const queries = [
    Job.find({ status: { $in: [...COMPLETED_STATUSES, 'cancelled'] }, 'assignedTechnician._id': { $ne: null } }).select('status workType additionalWorkType category assignedTechnician._id').session(session).lean(),
    User.find({ role: 'technician', accountStatus: { $in: ROUTABLE_ACCOUNT_STATUSES } }).select('name phone email primaryService accountStatus technicianId profileImage technicianProfile.photoUrl serviceArea isOnline rating ratingCount addresses').session(session).lean(),
    Request.find({ job: job._id, initiatedBy: 'admin' }).select('technician status').session(session).lean(),
  ];
  // MongoDB transactions require sequential operations on their session.
  const results = [];
  if (session) { for (const query of queries) results.push(await query); }
  else results.push(...await Promise.all(queries));
  const [history, technicians, requests] = results;
  return rankTechnicians(job, history, technicians).map(t => ({ ...t,
    isOnline: t.accountStatus === 'online' || (t.accountStatus !== 'offline' && Boolean(t.isOnline)),
    photoUrl: t.technicianProfile?.photoUrl || t.profileImage?.url || '',
    isCurrentTechnician: String(job.assignedTechnician?._id || '') === String(t._id),
    alreadyInvited: requests.some(r => String(r.technician) === String(t._id)),
  }));
};

exports.getRoutingCandidates = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) throw error('Invalid job ID.', 400);
    const job = await Job.findById(req.params.jobId).lean();
    if (!job) throw error('Job not found.', 404);
    const technicians = await routingCandidates(job);
    res.json({ success: true, data: { technicians } });
  } catch (err) { next(err); }
};

exports.sendInvitation = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { message = '' } = req.body;
    const inputIds = req.body.technicianIds || (req.body.technicianId ? [req.body.technicianId] : []);
    if (!mongoose.isValidObjectId(jobId) || !Array.isArray(inputIds) || !inputIds.length || inputIds.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id)) || typeof message !== 'string' || message.length > 2000) {
      throw error('Select a valid job and at least one technician. Messages may contain up to 2000 characters.', 400);
    }
    const technicianIds = [...new Set(inputIds)];
    let invitations;
    await mongoose.connection.transaction(async session => {
      const job = await Job.findById(jobId).session(session);
      if (!job) throw error('Job not found.', 404);
      const isReplacementInvitation = job.status === 'assigned' && job.assignedTechnician?._id && job.assignedRequest;
      if (!openJob(job) && !isReplacementInvitation) throw error('Only open jobs or jobs with an active assignment can receive invitations.');
      const candidates = await routingCandidates(job, session);
      const eligible = new Set(candidates.filter(t => !t.isCurrentTechnician && !t.alreadyInvited).map(t => String(t._id)));
      if (technicianIds.some(id => !eligible.has(id))) throw error('Some selected technicians are unavailable, already invited, or have no matching completed work. Reload the list and try again.');
      const availability = openJob(job)
        ? { _id: jobId, status: 'open', 'assignedTechnician._id': null, assignedRequest: null }
        : { _id: jobId, status: 'assigned', 'assignedTechnician._id': job.assignedTechnician._id, assignedRequest: job.assignedRequest };
      const lockedJob = await Job.updateOne(availability, { $inc: { __v: 1 } }, { session });
      if (!lockedJob.matchedCount) throw error('This job assignment has changed. Refresh and try again.');
      invitations = await Request.create(technicianIds.map(technicianId => ({
        job: jobId, technician: technicianId, initiatedBy: 'admin', invitedBy: req.user._id,
        status: 'pending', offeredPay: job.pay || { type: 'fixed', fixedAmount: 0 }, adminMessage: message.trim(),
        conversation: [{ sender: 'admin', message: message.trim() || 'You are invited to this job. Please accept or reject the invitation.' }],
      })), { session, ordered: true });
    });
    await Promise.all(invitations.map(async invitation => {
      await notify(invitation._id, invitation.technician);
      try {
        await sendNotification.sendToTechnician(invitation.technician, {
          type: 'job_invitation', title: 'New Job Invitation', message: 'You have received a new job invitation from admin.',
          data: { jobId: String(jobId), requestId: String(invitation._id) },
        }, req.user);
      } catch (err) { console.warn('Invitation push notification failed:', err.message); }
    }));
    res.status(201).json({ success: true, message: 'Requests sent. Assignment is pending technician acceptance.', data: { request: invitations[0], requests: invitations } });
  } catch (err) { next(err.code === 11000 ? error('A selected technician has already been invited to this job.') : err); }
};

exports.respondToInvitation = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action) || !mongoose.isValidObjectId(req.params.requestId)) throw error('Choose accept or reject for a valid invitation.', 400);
    let invitation, assignedJob, previousTechnicianId, previousRequestId, replacementTechnicianName;
    await mongoose.connection.transaction(async session => {
      invitation = await Request.findOne({ _id: req.params.requestId, technician: req.user._id, initiatedBy: 'admin' }).session(session);
      if (!invitation) throw error('Invitation not found.', 404);
      if (invitation.status !== 'pending') throw error('This invitation has already been answered or is no longer available.');
      const technician = await User.findById(req.user._id).session(session);
      if (!activeTechnician(technician)) throw error('Your technician account is not active.', 403);
      const now = new Date();
      if (action === 'accept') {
        const amount = baseAmount(invitation.offeredPay);
        const currentJob = await Job.findById(invitation.job).session(session);
        const newAssignedTechnician = { _id: technician._id, name: technician.name, email: technician.email, phone: technician.phone };
        replacementTechnicianName = technician.name;
        if (openJob(currentJob)) {
          assignedJob = await Job.findOneAndUpdate({ _id: currentJob._id, status: 'open', 'assignedTechnician._id': null, assignedRequest: null }, {
            $set: { status: 'assigned', assignedRequest: invitation._id, assignedTechnician: newAssignedTechnician, finalPrice: amount },
            $push: { statusHistory: { status: 'assigned', note: 'Technician accepted the admin invitation.', changedAt: now }, conversation: { sender: 'system', message: `${technician.name} accepted the invitation and was assigned.`, createdAt: now } },
          }, { session, new: true, runValidators: true });
        } else if (currentJob?.status === 'assigned' && currentJob.assignedTechnician?._id && currentJob.assignedRequest) {
          previousTechnicianId = currentJob.assignedTechnician._id;
          previousRequestId = currentJob.assignedRequest;
          assignedJob = await Job.findOneAndUpdate({
            _id: currentJob._id,
            status: 'assigned',
            'assignedTechnician._id': previousTechnicianId,
            assignedRequest: previousRequestId,
          }, {
            $set: { assignedRequest: invitation._id, assignedTechnician: newAssignedTechnician, finalPrice: amount },
            $push: {
              statusHistory: { status: 'assigned', note: `${technician.name} accepted a replacement invitation.`, changedAt: now },
              conversation: { sender: 'system', message: `${technician.name} accepted a replacement invitation and took over the job.`, createdAt: now },
            },
          }, { session, new: true, runValidators: true });
          if (assignedJob) {
            const previousRequest = await Request.findById(previousRequestId).session(session);
            if (previousRequest) {
              previousRequest.status = 'rejected';
              previousRequest.adminMessage = `Assignment transferred to ${technician.name} after accepting a replacement invitation.`;
              previousRequest.respondedAt = now;
              previousRequest.releasedAt = now;
              previousRequest.paymentStatus = 'unpaid';
              previousRequest.completedAt = null;
              previousRequest.amountEarned = 0;
              previousRequest.finalJobAmount = null;
              previousRequest.conversation.push({ sender: 'system', message: `The job was reassigned to ${technician.name} after they accepted an invitation.`, createdAt: now });
              await previousRequest.save({ session });
            }
          }
        }
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
    if (assignedJob) await syncBookingFromTechnicianJob(assignedJob);
    await notify(invitation._id, req.user._id, assignedJob);
    if (previousRequestId) {
      try {
        const previousRequest = await Request.findById(previousRequestId).populate('job technician');
        getIO().to('admin').emit('request:updated', { request: previousRequest });
      } catch (err) { console.warn('Previous assignment update notification failed:', err.message); }
    }
    if (previousTechnicianId) {
      try {
        getIO().to(`technician:${previousTechnicianId}`).emit('job:unassigned', { jobId: String(assignedJob._id), reason: `Reassigned to ${replacementTechnicianName} after invitation acceptance.` });
      } catch (err) { console.warn('Previous technician socket notification failed:', err.message); }
      await sendNotification.sendToTechnician(previousTechnicianId, {
        type: 'job_reassigned',
        title: 'Job Reassigned',
        message: `${assignedJob.title} has been reassigned to ${replacementTechnicianName}.`,
        data: { jobId: String(assignedJob._id) },
      });
    }
    if (assignedJob) {
      await sendNotification.sendToTechnician(req.user._id, {
        type: 'job_assigned',
        title: 'Job Assigned',
        message: `You accepted ${assignedJob.title}.`,
        data: { jobId: String(assignedJob._id), requestId: String(invitation._id) },
      });
    }
    res.json({ success: true, message: action === 'accept' ? 'Invitation accepted. The job is assigned to you.' : 'Invitation rejected.', data: { request: invitation, job: assignedJob } });
  } catch (err) { next(err); }
};
exports.baseAmount = baseAmount;
