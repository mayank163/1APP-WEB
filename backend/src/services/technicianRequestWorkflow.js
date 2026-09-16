const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobRequest = require('../models/TechnicianJobRequest');
const AdditionalCharge = require('../models/AdditionalCharge');
const { getIO } = require('../utils/socketInstance');

const emit = (room, event, payload) => {
  try { getIO().to(room).emit(event, payload); } catch (error) { console.warn(`[Socket] ${event} failed:`, error.message); }
};

const baseAmount = (request, job) => {
  if (Number(request.counterOffer) > 0) return Number(request.counterOffer);
  const pay = job?.pay;
  if (typeof pay === 'number') return pay;
  if (pay?.type === 'hourly') return (pay.hourlyRate || 0) * (pay.maxHours || 0);
  if (pay?.type === 'perDevice') return (pay.perDeviceRate || 0) * (pay.maxDevices || 0);
  if (pay?.type === 'blended') return (pay.blendedFixedAmount || 0) + (pay.blendedHourlyRate || 0) * (pay.blendedMaxAddlHours || 0);
  return Number(pay?.fixedAmount || 0);
};

const tryAssignApprovedRequest = async (requestId) => {
  const request = await TechnicianJobRequest.findById(requestId).populate('job technician');
  if (!request || !request.adminApproved || request.status !== 'accepted' || !request.job || !request.technician) return { assigned: false, request };

  const charges = await AdditionalCharge.find({ request: requestId });
  if (charges.some(charge => !['accepted', 'rejected'].includes(charge.status))) return { assigned: false, request, waitingForCharges: true };

  const now = new Date();
  const claimedJob = await TechnicianJob.findOneAndUpdate(
    { _id: request.job._id, status: 'open', assignedRequest: null },
    { $set: { status: 'assigned', assignedRequest: request._id, assignedTechnician: { _id: request.technician._id, name: request.technician.name, email: request.technician.email, phone: request.technician.phone } }, $push: { conversation: { sender: 'system', message: `${request.technician.name} has been assigned to this job.`, createdAt: now } } },
    { new: true, runValidators: true }
  );
  if (!claimedJob) return { assigned: false, request, alreadyAssigned: true };

  const acceptedCharges = charges.filter(charge => charge.status === 'accepted');
  const fixedCharge = baseAmount(request, request.job);
  const additionalTotal = acceptedCharges.reduce((total, charge) => total + Number(charge.agreedAmount || 0), 0);
  request.agreedFixedCharge = fixedCharge;
  request.agreedAdditionalTotal = additionalTotal;
  request.agreedTotal = fixedCharge + additionalTotal;
  request.finalJobAmount = request.agreedTotal;
  request.paymentStatus = 'pending';
  request.conversation.push({ sender: 'system', type: 'final_amount', message: `Request approved and job assigned. Final amount: ₹${request.agreedTotal}.`, fixedJobCharge: fixedCharge, additionalChargesTotal: additionalTotal, finalAmount: request.agreedTotal, createdAt: now });
  await request.save();
  await TechnicianJob.findByIdAndUpdate(claimedJob._id, { finalPrice: request.agreedTotal });

  const payload = { requestId: request._id, request, job: claimedJob, finalJobAmount: request.agreedTotal };
  emit('admin', 'request:assigned', payload);
  emit(`request:${requestId}`, 'request:assigned', payload);
  emit(`technician:${request.technician._id}`, 'request:assigned', payload);
  return { assigned: true, request, job: claimedJob };
};

module.exports = { baseAmount, tryAssignApprovedRequest };