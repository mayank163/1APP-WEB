const mongoose = require('mongoose');
const User = require('../models/User');
const TechnicianJob = require('../models/TechnicianJob');
const TechnicianWithdrawal = require('../models/TechnicianWithdrawal');
const { parseOptions, buildFinancials } = require('../services/technicianFinancials');
exports.getFinancials = async (req, res, next) => {
  try {
    const options = parseOptions(req.query);
    const id = req.params.technicianId || req.user._id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid technician ID.' });
    const technician = await User.findOne({ _id: id, role: 'technician' }).select('totalEarnings totalWithdrawn').lean();
    if (!technician) return res.status(404).json({ success: false, message: 'Technician not found.' });
    const [jobs, withdrawals] = await Promise.all([
      TechnicianJob.find({ 'assignedTechnician._id': id, $or: [{ 'payment.status': 'paid' }, { status: { $in: ['checkout', 'completed', 'closed'] } }] }).select('title category finalPrice pay payment status jobCompletedAt completedAt updatedAt assignedRequest').populate({ path: 'assignedRequest', select: 'finalJobAmount' }).lean(),
      TechnicianWithdrawal.find({ technician: id }).select('amount status method createdAt').sort('-createdAt').lean()
    ]);
    res.json({ success: true, data: buildFinancials(technician, jobs, withdrawals, options) });
  } catch (error) { next(error); }
};
