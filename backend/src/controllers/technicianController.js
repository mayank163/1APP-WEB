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
    const { jobId } = req.params;
    const { note } = req.body;

    const job = await TechnicianJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const existingRequest = await TechnicianJobRequest.findOne({
      job: jobId,
      technician: req.user._id,
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already requested this job' });
    }

    const request = await TechnicianJobRequest.create({
      job: jobId,
      technician: req.user._id,
      note: note || '',
      status: 'pending',
    });

    res.status(201).json({ success: true, message: 'Job request sent', data: { request } });
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

module.exports = {
  getJobsForTechnicians,
  requestJob,
  getMyRequests,
  getTechnicianDashboard,
  createWithdrawalRequest,
  updateRequestStatus,
  getMetrics,
};
