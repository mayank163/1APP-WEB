const User = require('../models/User');
const { emitVerificationUpdated } = require('../utils/socketEvents');

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
          profilePhoto:           user.technicianProfile?.photoUrl || '',
          drivingLicenseFront:    user.technicianProfile?.drivingLicense?.front || '',
          drivingLicenseBack:     user.technicianProfile?.drivingLicense?.back || '',
          residentialProof:       user.technicianProfile?.residentialProof || '',
          taxInformationW9:       user.technicianProfile?.taxInformation?.w9Form || '',
          taxInformation1099:     user.technicianProfile?.taxInformation?.form1099 || '',
          cvResume:               user.technicianProfile?.cvResume || '',
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

    const prev = technician.technicianProfile || {};
    technician.technicianProfile = {
      ...prev,
      drivingLicense:  { front: prev.drivingLicense?.front || '', back: prev.drivingLicense?.back || '' },
      taxInformation:  { w9Form: prev.taxInformation?.w9Form || '', form1099: prev.taxInformation?.form1099 || '' },
      verificationStatus: status,
      verificationNotes: notes || prev.verificationNotes || ''
    };

    await technician.save();

    emitVerificationUpdated(technicianId, status, notes || '');

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
