const Booking = require('../models/Booking');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianJobTemplate = require('../models/TechnicianJobTemplate');
const { getIO } = require('../utils/socketInstance');
const { sendBookingStatusUpdated } = require('../utils/emailService');

const bookingStatusByJobStatus = {
  open: 'Confirmed',
  assigned: 'Assigned',
  ontheway: 'On the Way',
  visited: 'In Progress',
  inprogress: 'In Progress',
  'in-progress': 'In Progress',
  checkout: 'Completed',
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

const ensureTechnicianJobForBooking = async (booking, postedBy) => {
  if (!booking?._id || !postedBy) return null;

  let job = await TechnicianJob.findOne({ sourceBooking: booking._id });
  if (job) return job;

  const serviceNames = (booking.services || [])
    .map(item => item.service?.name)
    .filter(Boolean);
  const addonNames = (booking.services || [])
    .flatMap(item => item.selectedAddons || [])
    .map(addon => addon.name?.trim())
    .filter(Boolean);
  const baseTitle = serviceNames.join(' + ') || `Service booking #${String(booking._id).slice(-6)}`;
  const addonTitle = addonNames.length ? ` - Add-ons: ${addonNames.join(', ')}` : '';
  const location = getBookingLocation(booking.address) || 'Customer location';
  const template = await TechnicianJobTemplate.findOne({
    templateName: /^workorder$/i,
  }).sort('-createdAt');
  if (!template) {
    console.warn('Job template named "workorder" was not found; using booking defaults.');
  }

  try {
    job = await TechnicianJob.create({
      title: `${serviceNames.length ? baseTitle : (template?.title || baseTitle)}${addonTitle}`,
      category: 'Booked Service',
      location,
      city: booking.address?.city || '',
      state: booking.address?.state || '',
      zipCode: booking.address?.zipcode || '',
      coordinates: booking.address?.coordinates || template?.coordinates,
      description: [
        template?.description,
        `Work order created from booking ${booking._id}.`,
      ].filter(Boolean).join('\n\n'),
      requirements: template?.requirements || [],
      preferredSkills: template?.preferredSkills || [],
      workType: template?.workType || {},
      additionalWorkType: template?.additionalWorkType || {},
      serviceType: template?.serviceType || {},
      tasks: (template?.tasks || []).map((task, order) => ({
        title: task.title || '',
        group: task.group || '',
        order: task.order ?? order,
        isDone: false,
        requiresNote: Boolean(task.requiresNote),
        requiresImage: Boolean(task.requiresImage),
        requiresSignature: Boolean(task.requiresSignature),
        requirementReason: task.requirementReason || '',
      })),
      postedBy,
      sourceBooking: booking._id,
      status: 'draft',
      visibleTo: template?.visibleTo || 'technicians',
      scheduledDate: booking.serviceDate || null,
      jobDate: {
        from: booking.serviceDate || null,
        to: template?.jobDate?.to || null,
      },
      pay: template?.pay || { type: 'fixed', fixedAmount: Number(booking.totalAmount) || 0 },
    });
  } catch (error) {
    if (error.code === 11000) return TechnicianJob.findOne({ sourceBooking: booking._id });
    throw error;
  }

  try {
    getIO().to('admin').emit('job:created', { job });
  } catch (error) {
    console.error('Failed to announce booking work order to admins:', error.message);
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