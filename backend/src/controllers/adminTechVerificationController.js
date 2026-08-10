const User = require('../models/User');

const getTechnicianVerificationRequests = async (req, res, next) => {
  try {
    const technicians = await User.find({ role: 'technician' }).sort('-createdAt');

    const requests = technicians
      .filter((user) => user.technicianProfile && user.technicianProfile.verificationStatus)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        skills: user.skills || user.technicianProfile?.skills || [],
        experienceLevel: user.experienceLevel || user.technicianProfile?.experienceLevel || 'Beginner',
        yearsOfExperience: user.technicianProfile?.yearsOfExperience || 0,
        certifications: user.technicianProfile?.certifications || [],
        documents: {
          profilePhoto: user.technicianProfile?.photoUrl || '',
          drivingLicenseFront: user.technicianProfile?.drivingLicenseFront || '',
          drivingLicenseBack: user.technicianProfile?.drivingLicenseBack || '',
          residentialProof: user.technicianProfile?.residentialProof || '',
          taxInformation: user.technicianProfile?.taxInformation || '',
          cvResume: user.technicianProfile?.cvResume || '',
          backgroundVerification: user.technicianProfile?.backgroundVerification || '',
        },
        verificationStatus: user.technicianProfile?.verificationStatus || 'not-started',
        verificationNotes: user.technicianProfile?.verificationNotes || '',
        submittedAt: user.technicianProfile?.submittedAt || user.createdAt,
        bankDetails: user.bankDetails || {},
      }));

    res.status(200).json({ success: true, data: { requests } });
  } catch (error) {
    next(error);
  }
};

const updateTechnicianVerificationStatus = async (req, res, next) => {
  try {
    const { technicianId } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    technician.technicianProfile = {
      ...technician.technicianProfile,
      verificationStatus: status,
      verificationNotes: notes || technician.technicianProfile?.verificationNotes || ''
    };

    await technician.save();

    res.status(200).json({
      success: true,
      message: `Technician verification status updated to ${status}`,
      data: { technician }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTechnicianVerificationRequests,
  updateTechnicianVerificationStatus,
};
