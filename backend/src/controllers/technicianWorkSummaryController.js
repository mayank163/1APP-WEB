const mongoose = require('mongoose');
const User = require('../models/User');
const TechnicianJob = require('../models/TechnicianJob');
const { buildWorkSummary, COMPLETED_STATUSES } = require('../services/technicianWorkSummary');

exports.getWorkSummary = async (req, res, next) => {
  try {
    const id = req.params.technicianId || req.user._id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid technician ID.' });
    if (!await User.exists({ _id: id, role: 'technician' })) return res.status(404).json({ success: false, message: 'Technician not found.' });
    const jobs = await TechnicianJob.find({ 'assignedTechnician._id': id, status: { $in: COMPLETED_STATUSES } })
      .select('status category workType additionalWorkType serviceType jobCompletedAt completedAt completedStatus.at technicianRating.score pay.type pay.hourlyRate').lean();
    res.json({ success: true, data: { technicianId: String(id), ...buildWorkSummary(jobs) } });
  } catch (error) { next(error); }
};
