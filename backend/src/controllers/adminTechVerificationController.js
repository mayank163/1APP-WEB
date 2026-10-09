const User = require('../models/User');
const Admin = require('../models/Admin');
const mongoose = require('mongoose');
const { emitVerificationUpdated } = require('../utils/socketEvents');

const getTechnicianVerificationRequests = async (req, res, next) => {
  try {
    const technicians = await User.find({ role: 'technician' }).sort('-createdAt');

    const reviewers = await Admin.find({ isSuperAdmin: { $ne: true }, isActive: true }).select('_id name email').sort('name');
    const reviewerNames = new Map(reviewers.map(admin => [String(admin._id), admin.name]));

    const requests = technicians
      .filter((user) => user.technicianProfile && user.technicianProfile.verificationStatus)
      .map((user) => ({
        _id: user._id,
        name: user.name,
        reviewerId: user.technicianProfile?.reviewer ? String(user.technicianProfile.reviewer) : null,
        reviewer: reviewerNames.get(String(user.technicianProfile?.reviewer)) || '',
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
        drivingLicense: {
          issuedDate: user.technicianProfile?.drivingLicense?.issuedDate || null,
          expiryDate: user.technicianProfile?.drivingLicense?.expiryDate || null,
        },
        documentStatuses: user.technicianProfile?.documents || [],
        verificationStatus: user.technicianProfile?.verificationStatus || 'not-started',
        verificationNotes: user.technicianProfile?.verificationNotes || '',
        submittedAt: user.technicianProfile?.submittedAt || user.createdAt,
        bankDetails: user.bankDetails || {},
      }));

    res.status(200).json({ success: true, data: { requests, reviewers } });
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
      drivingLicense:  { ...prev.drivingLicense, front: prev.drivingLicense?.front || '', back: prev.drivingLicense?.back || '' },
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

const assignReviewer = async (req, res, next) => {
  try {
    const { technicianId } = req.params;
    const { reviewerId } = req.body;
    if (!mongoose.isValidObjectId(technicianId) || (reviewerId !== null && !mongoose.isValidObjectId(reviewerId))) {
      return res.status(400).json({ success: false, message: 'Invalid technician or reviewer ID' });
    }
    let reviewer = null;
    if (reviewerId !== null) {
      reviewer = await Admin.findOne({ _id: reviewerId, isSuperAdmin: { $ne: true }, isActive: true }).select('_id name');
      if (!reviewer) return res.status(400).json({ success: false, message: 'Select an active sub-admin as reviewer' });
    }
    const technician = await User.findOneAndUpdate(
      { _id: technicianId, role: 'technician' },
      { $set: { 'technicianProfile.reviewer': reviewerId } },
      { new: true, runValidators: true }
    );
    if (!technician) return res.status(404).json({ success: false, message: 'Technician not found' });
    emitVerificationUpdated(technicianId, technician.technicianProfile?.verificationStatus, '');
    res.status(200).json({ success: true, message: 'Reviewer updated', data: { reviewerId, reviewer: reviewer?.name || '' } });
  } catch (error) { next(error); }
};

// PATCH /api/admin/technician-verifications/:technicianId/documents/:documentId
const updateDocumentStatus = async (req, res, next) => {
  try {
    const { technicianId, documentId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const technician = await User.findById(technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    const docs = technician.technicianProfile?.documents || [];
    const idx  = docs.findIndex(d => d.documentId === documentId);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Document not found' });

    docs[idx].status          = status;
    docs[idx].rejectionReason = status === 'rejected' ? (rejectionReason || 'Rejected by admin') : null;

    technician.technicianProfile.documents = docs;
    await technician.save();

    // Emit socket event so technician app updates in real-time
    emitVerificationUpdated(technicianId, technician.technicianProfile.verificationStatus, '');

    res.status(200).json({
      success: true,
      message: `Document ${documentId} marked as ${status}`,
      data: { document: docs[idx] }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTechnicianVerificationRequests,
  updateTechnicianVerificationStatus,
  updateDocumentStatus,
  assignReviewer,
};
