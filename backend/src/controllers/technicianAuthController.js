const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../utils/otpService');

const pendingTechnicianRegistrations = new Map();
const PENDING_TEC_REGISTRATION_TTL = 5 * 60 * 1000;

const signToken = (id, role) => jwt.sign(
  { id, role },
  process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: { user }
  });
};

exports.startTechnicianSignup = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, password and phone number' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'Phone number is already registered' });
    }

    pendingTechnicianRegistrations.set(phone, {
      technicianData: { name, email: email.toLowerCase(), password, phone, role: 'technician' },
      expires: Date.now() + PENDING_TEC_REGISTRATION_TTL
    });

    await otpService.sendOTP(phone);
    const otp = otpService.getLastOTP ? otpService.getLastOTP(phone) : null;

    res.status(200).json({
      success: true,
      message: 'OTP sent to your phone number',
      phone,
      ...(otp && { devOtp: otp })
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyTechnicianOTP = async (req, res, next) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const pending = pendingTechnicianRegistrations.get(phone);
    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending technician registration found. Please signup again.' });
    }

    if (Date.now() > pending.expires) {
      pendingTechnicianRegistrations.delete(phone);
      return res.status(400).json({ success: false, message: 'OTP expired. Please sign up again.' });
    }

    const isValid = otpService.verifyOTP(phone, code);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code' });
    }

    const technician = await User.create({
      ...pending.technicianData,
      isPhoneVerified: true,
      profileCompleted: false
    });

    pendingTechnicianRegistrations.delete(phone);
    sendTokenResponse(technician, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.completeTechnicianProfile = async (req, res, next) => {
  try {
    const { skills, experienceLevel, yearsOfExperience, certifications } = req.body;
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can complete this profile' });
    }

    technician.skills = Array.isArray(skills) ? skills : [];
    technician.experienceLevel = experienceLevel || 'Beginner';
    technician.technicianProfile = {
      ...technician.technicianProfile,
      skills: Array.isArray(skills) ? skills : [],
      experienceLevel: experienceLevel || 'Beginner',
      yearsOfExperience: Number(yearsOfExperience || 0),
      certifications: Array.isArray(certifications) ? certifications : [],
    };

    technician.profileCompleted = true;
    await technician.save();

    res.status(200).json({
      success: true,
      message: 'Technician profile details saved',
      data: { user: technician }
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadTechnicianDocuments = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can upload documents' });
    }

    if (!req.files) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const fileMap = {
      drivingLicenseFront: req.files.drivingLicenseFront?.[0]?.filename || '',
      drivingLicenseBack: req.files.drivingLicenseBack?.[0]?.filename || '',
      residentialProof: req.files.residentialProof?.[0]?.filename || '',
      taxInformation: req.files.taxInformation?.[0]?.filename || '',
      cvResume: req.files.cvResume?.[0]?.filename || '',
      backgroundVerification: req.files.backgroundVerification?.[0]?.filename || '',
      photoUrl: req.files.profilePhoto?.[0]?.filename || ''
    };

    technician.technicianProfile = {
      ...technician.technicianProfile,
      drivingLicenseFront: fileMap.drivingLicenseFront,
      drivingLicenseBack: fileMap.drivingLicenseBack,
      residentialProof: fileMap.residentialProof,
      taxInformation: fileMap.taxInformation,
      cvResume: fileMap.cvResume,
      backgroundVerification: fileMap.backgroundVerification,
      photoUrl: fileMap.photoUrl,
      verificationStatus: 'pending'
    };

    await technician.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: { user: technician }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBankDetails = async (req, res, next) => {
  try {
    const { accountHolder, bankName, accountNumber, ifscCode, upiId } = req.body;
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can update bank details' });
    }

    technician.bankDetails = {
      accountHolder: accountHolder || technician.bankDetails?.accountHolder || '',
      bankName: bankName || technician.bankDetails?.bankName || '',
      accountNumber: accountNumber || technician.bankDetails?.accountNumber || '',
      ifscCode: ifscCode || technician.bankDetails?.ifscCode || '',
      upiId: upiId || technician.bankDetails?.upiId || ''
    };

    await technician.save();

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      data: { user: technician }
    });
  } catch (error) {
    next(error);
  }
};

exports.submitForVerification = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can submit for verification' });
    }

    technician.technicianProfile = {
      ...technician.technicianProfile,
      verificationStatus: 'pending',
      submittedAt: new Date()
    };

    await technician.save();

    res.status(200).json({
      success: true,
      message: 'Technician application submitted for verification',
      data: { user: technician }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTechnicianProfile = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Technician profile not found' });
    }

    res.status(200).json({
      success: true,
      data: { user: technician }
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadProfileImageHandler = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can upload a profile image' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    // Store as base64 data URL so it works without a separate file server
    const mimeType = req.file.mimetype;
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    technician.profileImage = {
      url: dataUrl,
      s3Key: ''
    };
    // Also mirror into technicianProfile.photoUrl so verification flow picks it up
    technician.technicianProfile = {
      ...technician.technicianProfile,
      photoUrl: dataUrl
    };

    await technician.save();

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: { profileImageUrl: dataUrl }
    });
  } catch (error) {
    next(error);
  }
};
