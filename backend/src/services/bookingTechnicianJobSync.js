const Booking = require('../models/Booking');
const TechnicianJob = require('../models/TechnicianJob');
const User = require('../models/User');
const sendNotification = require('./notificationService');
const { getIO } = require('../utils/socketInstance');
const { sendBookingStatusUpdated } = require('../utils/emailService');

const bookingStatusByJobStatus = {
  open: 'Confirmed',
  assigned: 'Assigned',
  ontheway: 'On the Way',
  visited: 'In Progress',
  inprogress: 'In Progress',
  'in-progress': 'In Progress',
  checkout: 'Checkout',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const getBookingLocation = address => {
  if (typeof address === 'string') return address.trim();
  return [address?.addressLine, address?.city, address?.state, address?.zipcode]
    .filter(part => typeof part === 'string' && part.trim())
    .map(part => part.trim())
    .join(', ');
};

const ensureTechnicianJobForBooking = async (booking, postedBy, sender = postedBy) => {
  if (!booking?._id || !postedBy) return null;

  let job = await TechnicianJob.findOne({ sourceBooking: booking._id });
  if (job) return job;

  const serviceNames = (booking.services || [])
    .map(item => item.service?.name)
    .filter(Boolean);
  const jobTitle = serviceNames.join(' + ') || `Service booking #${String(booking._id).slice(-6)}`;
  const location = getBookingLocation(booking.address) || 'Customer location';

  try {
    job = await TechnicianJob.create({
      title: jobTitle,
      category: 'Booked Service',
      location,
      city: booking.address?.city || '',
      state: booking.address?.state || '',
      zipCode: booking.address?.zipcode || '',
      description: `Work order created from booking ${booking._id}.`,
      postedBy,
      sourceBooking: booking._id,
      status: 'open',
      visibleTo: 'technicians',
      scheduledDate: booking.serviceDate || null,
      jobDate: { from: booking.serviceDate || null },
      pay: { type: 'fixed', fixedAmount: Number(booking.totalAmount) || 0 },
    });
  } catch (error) {
    if (error.code === 11000) return TechnicianJob.findOne({ sourceBooking: booking._id });
    throw error;
  }

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
        data: { jobId: String(job._id), type: 'new_job' },
      });
    }
    getIO().emit('job:new', { job });
  } catch (error) {
    console.error('Failed to announce booking work order:', error.message);
  }

  return job;
};

const syncBookingFromTechnicianJob = async job => {
  if (!job?.sourceBooking) return null;

  try {
    const booking = await Booking.findById(job.sourceBooking);
    if (!booking) return null;

    const nextStatus = bookingStatusByJobStatus[String(job.status || '').toLowerCase()];
    const statusChanged = Boolean(nextStatus && booking.status !== nextStatus);
    const shouldClearTechnician = ['open', 'cancelled'].includes(String(job.status || '').toLowerCase());
    const nextTechnician = shouldClearTechnician
      ? { name: '', phone: '' }
      : {
          name: job.assignedTechnician?.name || booking.assignedTechnician?.name || '',
          phone: job.assignedTechnician?.phone || booking.assignedTechnician?.phone || '',
        };
    const technicianChanged = booking.assignedTechnician?.name !== nextTechnician.name ||
      booking.assignedTechnician?.phone !== nextTechnician.phone;

    if (!statusChanged && !technicianChanged) return booking;
    if (statusChanged) booking.status = nextStatus;
    if (technicianChanged) booking.assignedTechnician = nextTechnician;
    await booking.save();

    if (statusChanged || technicianChanged) {
      const populatedBooking = await Booking.findById(booking._id)
        .populate('user')
        .populate('services.service');
      if (populatedBooking?.user?.email) {
        sendBookingStatusUpdated(populatedBooking).catch(error =>
          console.error('Technician job booking email failed:', error.message)
        );
      }
    }
    return booking;
  } catch (error) {
    console.error('Failed to synchronize technician job with booking:', error.message);
    return null;
  }
};

module.exports = {
  bookingStatusByJobStatus,
  ensureTechnicianJobForBooking,
  syncBookingFromTechnicianJob,
};