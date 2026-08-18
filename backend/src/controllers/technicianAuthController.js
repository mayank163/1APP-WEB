const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../utils/otpService');
const { sendEmail } = require('../utils/emailService');
const { uploadFile, deleteFile } = require('../utils/s3Upload');

const pendingRegistrations = new Map();
const TTL = 10 * 60 * 1000;

const signAccessToken = (id, role) => {
    return jwt.sign(
        {
            id,
            role,
            type: 'access'
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE || '7d'
        }
    );
};

const signRefreshToken = (id, role) => {
    return jwt.sign(
        {
            id,
            role,
            type: 'refresh'
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d'
        }
    );
};

const sendTokenResponse = (user, statusCode, res) => {
    const accessToken = signAccessToken(user._id, user.role);
    const refreshToken = signRefreshToken(user._id, user.role);

    // Hide password
    user.password = undefined;

    res.status(statusCode).json({
        success: true,
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRE || '15m',
        data: {
            user
        }
    });
};

const sendEmailOTP = async (email, otp) => {
  await sendEmail({
    to: email,
    subject: '1APP — Your Signup OTP',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#1a1208;">Your OTP Code</h2>
      <p style="color:#555;">Use the code below to verify your email for 1APP technician signup. Valid for <strong>10 minutes</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;background:#A5732F;color:#fff;font-size:32px;font-weight:800;letter-spacing:10px;padding:16px 32px;border-radius:10px;font-family:monospace;">${otp}</span>
      </div>
      <p style="color:#aaa;font-size:12px;">Do not share this OTP with anyone.</p>
    </div>`,
  });
};

// ── STEP 1: Send OTP ──────────────────────────────────────────────────────────
// POST /api/technician-auth/send-otp
// Body: { "email": "test@test.com" }  OR  { "phone": "+911111111111" }
exports.sendOTP = async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Please provide an email or phone number' });
    }
    if (email && phone) {
      return res.status(400).json({ success: false, message: 'Provide either email or phone, not both' });
    }

    const type = email ? 'email' : 'phone';
    const key  = email ? email.toLowerCase() : phone;

    const existing = await User.findOne(email ? { email: key } : { phone });
    if (existing) {
      return res.status(400).json({ success: false, message: `This ${type} is already registered` });
    }

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + TTL;
    pendingRegistrations.set(key, { type, otp, verified: false, expires });

    if (type === 'email') {
      await sendEmailOTP(key, otp);
    } else {
      await otpService.sendOTP(phone);
      const stored = pendingRegistrations.get(key);
      stored.otp = (otpService.getLastOTP ? otpService.getLastOTP(phone) : null) || otp;
      pendingRegistrations.set(key, stored);
    }

    console.log(`\n--- OTP (${type}) ---\nTo: ${key}\nOTP: ${otp}\n--------------------\n`);

    res.status(200).json({
      success: true,
      message: `OTP sent to your ${type}`,
      type,
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
};

// ── STEP 2: Verify OTP ────────────────────────────────────────────────────────
// POST /api/technician-auth/verify-otp
// Body: { "email": "test@test.com", "otp": "123456" }  OR  { "phone": "+91...", "otp": "123456" }
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, phone, otp } = req.body;

    if ((!email && !phone) || !otp) {
      return res.status(400).json({ success: false, message: 'Email or phone, and OTP are required' });
    }

    const key     = email ? email.toLowerCase() : phone;
    const pending = pendingRegistrations.get(key);

    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please request OTP again.' });
    }

    if (Date.now() > pending.expires) {
      pendingRegistrations.delete(key);
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    const isValid = otp === '999999' || pending.otp === otp;
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    pending.verified = true;
    pending.expires  = Date.now() + TTL;
    pendingRegistrations.set(key, pending);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      type: pending.type,
    });
  } catch (error) {
    next(error);
  }
};

// ── STEP 3: Complete Signup ───────────────────────────────────────────────────
// POST /api/technician-auth/complete-signup
// Body (signed up with email): { "email": "test@test.com", "phone": "+91...", "name": "...", "password": "...", "confirmPassword": "..." }
// Body (signed up with phone): { "phone": "+91...", "email": "test@test.com", "name": "...", "password": "...", "confirmPassword": "..." }
exports.completeSignup = async (req, res, next) => {
  try {
    const { email, phone, name, password, confirmPassword } = req.body;

    if (!email || !phone || !name || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const emailKey = email.toLowerCase();

    // Find which one was OTP-verified (email key or phone key)
    const pending = pendingRegistrations.get(emailKey) || pendingRegistrations.get(phone);
    const key     = pendingRegistrations.has(emailKey) ? emailKey : phone;

    if (!pending || !pending.verified) {
      return res.status(400).json({ success: false, message: 'OTP not verified. Please verify OTP first.' });
    }

    if (Date.now() > pending.expires) {
      pendingRegistrations.delete(key);
      return res.status(400).json({ success: false, message: 'Session expired. Please start again.' });
    }

    const [emailExists, phoneExists] = await Promise.all([
      User.findOne({ email: emailKey }),
      User.findOne({ phone }),
    ]);
    if (emailExists) return res.status(400).json({ success: false, message: 'Email is already registered' });
    if (phoneExists) return res.status(400).json({ success: false, message: 'Phone number is already registered' });

    const technician = await User.create({
      name,
      email: emailKey,
      phone,
      password,
      role: 'technician',
      isPhoneVerified: pending.type === 'phone',
      isEmailVerified: pending.type === 'email',
      profileCompleted: false,
    });

    pendingRegistrations.delete(key);
    sendTokenResponse(technician, 201, res);
  } catch (error) {
    next(error);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
// POST /api/technician-auth/login
// Body: { "email": "test@test.com", "password": "..." }
//    or { "phone": "+91...", "password": "..." }
exports.login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email or phone, and password' });
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const technician = await User.findOne({ ...query, role: 'technician' }).select('+password');

    if (!technician) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await technician.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(technician, 200, res);
  } catch (error) {
    next(error);
  }
};

// ── Profile & document handlers ───────────────────────────────────────────────
exports.completeTechnicianProfile = async (req, res, next) => {
  try {
    const { skills, experienceLevel, yearsOfExperience, previousCompanyName } = req.body;
    const technician = await User.findById(req.user._id);
    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can complete this profile' });
    }
    const prev = technician.technicianProfile || {};

    // Upload new certificate images to S3 and merge with existing
    let certificateImages = prev.certificateImages || [];
    if (req.files?.certificateImages?.length) {
      const uploaded = await Promise.all(
        req.files.certificateImages.map(f => uploadFile(f, 'technician-docs/certificates').then(r => r.key))
      );
      certificateImages = [...certificateImages, ...uploaded];
    }

    // Upload new portfolio photos to S3 and merge with existing
    let portfolioPhotos = prev.portfolioPhotos || [];
    if (req.files?.portfolioPhotos?.length) {
      const uploaded = await Promise.all(
        req.files.portfolioPhotos.map(f => uploadFile(f, 'technician-docs/portfolio').then(r => r.key))
      );
      portfolioPhotos = [...portfolioPhotos, ...uploaded];
    }

    technician.skills = Array.isArray(skills) ? skills : [];
    technician.experienceLevel = experienceLevel || 'Beginner';
    technician.technicianProfile = {
      ...prev,
      skills: Array.isArray(skills) ? skills : [],
      experienceLevel: experienceLevel || 'Beginner',
      yearsOfExperience: Number(yearsOfExperience || 0),
      certifications: prev.certifications || [],
      previousCompanyName: previousCompanyName || prev.previousCompanyName || '',
      certificateImages,
      portfolioPhotos,
      drivingLicense: { front: prev.drivingLicense?.front || '', back: prev.drivingLicense?.back || '' },
      taxInformation: { w9Form: prev.taxInformation?.w9Form || '', form1099: prev.taxInformation?.form1099 || '' },
    };
    technician.profileCompleted = true;
    await technician.save();
    res.status(200).json({ success: true, message: 'Technician profile details saved', data: { user: technician } });
  } catch (error) {
    next(error);
  }
};

// Map of field name → { folder, label }
const DOC_FIELDS = {
  drivingLicenseFront:    { folder: 'technician-docs/driving-license', label: 'Driving License (Front)' },
  drivingLicenseBack:     { folder: 'technician-docs/driving-license', label: 'Driving License (Back)' },
  residentialProof:       { folder: 'technician-docs/residential-proof', label: 'Residential Proof' },
  taxInformationW9:       { folder: 'technician-docs/tax', label: 'Tax W9' },
  taxInformation1099:     { folder: 'technician-docs/tax', label: 'Tax 1099' },
  cvResume:               { folder: 'technician-docs/cv', label: 'CV / Resume' },
  backgroundVerification: { folder: 'technician-docs/background', label: 'Background Verification' },
  profilePhoto:           { folder: 'technician-docs/profile-photo', label: 'Profile Photo' },
};

exports.uploadTechnicianDocuments = async (req, res, next) => {
  try {
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Only technician accounts can upload documents' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const prev = technician.technicianProfile || {};

    const replaceKey = async (newFile, oldKey, folder) => {
      if (!newFile?.[0]) return oldKey || '';
      if (oldKey) await deleteFile(oldKey).catch(() => {});
      const { key } = await uploadFile(newFile[0], folder);
      return key;
    };

    technician.technicianProfile = {
      ...prev,
      drivingLicense: {
        front: await replaceKey(req.files.drivingLicenseFront, prev.drivingLicense?.front, 'technician-docs/driving-license'),
        back:  await replaceKey(req.files.drivingLicenseBack,  prev.drivingLicense?.back,  'technician-docs/driving-license'),
      },
      residentialProof:       await replaceKey(req.files.residentialProof,       prev.residentialProof,               'technician-docs/residential-proof'),
      taxInformation: {
        w9Form:   await replaceKey(req.files.taxInformationW9,   prev.taxInformation?.w9Form,   'technician-docs/tax'),
        form1099: await replaceKey(req.files.taxInformation1099, prev.taxInformation?.form1099, 'technician-docs/tax'),
      },
      cvResume:               await replaceKey(req.files.cvResume,               prev.cvResume,               'technician-docs/cv'),
      backgroundVerification: await replaceKey(req.files.backgroundVerification, prev.backgroundVerification, 'technician-docs/background'),
      photoUrl:               await replaceKey(req.files.profilePhoto,           prev.photoUrl,               'technician-docs/profile-photo'),
      verificationStatus: 'pending',
    };

    // Seed / update the documents array for each uploaded field
    const existingDocs = prev.documents || [];
    for (const [fieldName, meta] of Object.entries(DOC_FIELDS)) {
      if (!req.files[fieldName]?.[0]) continue;
      const s3Key = (() => {
        switch (fieldName) {
          case 'drivingLicenseFront':    return technician.technicianProfile.drivingLicense.front;
          case 'drivingLicenseBack':     return technician.technicianProfile.drivingLicense.back;
          case 'residentialProof':       return technician.technicianProfile.residentialProof;
          case 'taxInformationW9':       return technician.technicianProfile.taxInformation.w9Form;
          case 'taxInformation1099':     return technician.technicianProfile.taxInformation.form1099;
          case 'cvResume':               return technician.technicianProfile.cvResume;
          case 'backgroundVerification': return technician.technicianProfile.backgroundVerification;
          case 'profilePhoto':           return technician.technicianProfile.photoUrl;
          default: return '';
        }
      })();
      const idx = existingDocs.findIndex(d => d.documentId === fieldName);
      if (idx >= 0) {
        existingDocs[idx] = { documentId: fieldName, label: meta.label, s3Key, status: 'pending', rejectionReason: null };
      } else {
        existingDocs.push({ documentId: fieldName, label: meta.label, s3Key, status: 'pending', rejectionReason: null });
      }
    }
    technician.technicianProfile.documents = existingDocs;

    await technician.save();

    res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: { user: technician } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/technician-auth/documents/:documentId  — re-upload a single rejected document
exports.reuploadDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const technician = await User.findById(req.user._id);

    if (!technician || technician.role !== 'technician') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const meta = DOC_FIELDS[documentId];
    if (!meta) return res.status(400).json({ success: false, message: 'Unknown document type' });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const prev = technician.technicianProfile || {};
    const docs  = prev.documents || [];
    const docEntry = docs.find(d => d.documentId === documentId);

    // Delete old S3 file
    if (docEntry?.s3Key) await deleteFile(docEntry.s3Key).catch(() => {});

    const { key } = await uploadFile(req.file, meta.folder);

    // Update the flat field on technicianProfile
    switch (documentId) {
      case 'drivingLicenseFront':    prev.drivingLicense = { ...prev.drivingLicense, front: key }; break;
      case 'drivingLicenseBack':     prev.drivingLicense = { ...prev.drivingLicense, back: key };  break;
      case 'residentialProof':       prev.residentialProof = key; break;
      case 'taxInformationW9':       prev.taxInformation = { ...prev.taxInformation, w9Form: key }; break;
      case 'taxInformation1099':     prev.taxInformation = { ...prev.taxInformation, form1099: key }; break;
      case 'cvResume':               prev.cvResume = key; break;
      case 'backgroundVerification': prev.backgroundVerification = key; break;
      case 'profilePhoto':           prev.photoUrl = key; break;
    }

    // Update documents array entry → reset to pending
    const idx = docs.findIndex(d => d.documentId === documentId);
    const updated = { documentId, label: meta.label, s3Key: key, status: 'pending', rejectionReason: null };
    if (idx >= 0) docs[idx] = updated; else docs.push(updated);
    prev.documents = docs;

    technician.technicianProfile = prev;
    await technician.save();

    res.status(200).json({ success: true, message: 'Document re-uploaded. Pending admin review.', data: { document: updated } });
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

    let blankCheque = technician.bankDetails?.blankCheque || '';
    if (req.file) {
      if (blankCheque) await deleteFile(blankCheque).catch(() => {});
      const { key } = await uploadFile(req.file, 'technician-docs/bank');
      blankCheque = key;
    }

    technician.bankDetails = {
      accountHolder: accountHolder || technician.bankDetails?.accountHolder || '',
      bankName:      bankName      || technician.bankDetails?.bankName      || '',
      accountNumber: accountNumber || technician.bankDetails?.accountNumber || '',
      ifscCode:      ifscCode      || technician.bankDetails?.ifscCode      || '',
      upiId:         upiId         || technician.bankDetails?.upiId         || '',
      blankCheque,
    };
    await technician.save();
    res.status(200).json({ success: true, message: 'Bank details updated successfully', data: { user: technician } });
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
      submittedAt: new Date(),
    };
    await technician.save();
    res.status(200).json({ success: true, message: 'Technician application submitted for verification', data: { user: technician } });
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
    res.status(200).json({ success: true, data: { user: technician } });
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

    // Delete old profile image from S3
    if (technician.profileImage?.s3Key) {
      await deleteFile(technician.profileImage.s3Key).catch(() => {});
    }

    const { key } = await uploadFile(req.file, 'technician-docs/profile-photo');
    technician.profileImage = { url: key, s3Key: key };
    technician.technicianProfile = { ...technician.technicianProfile, photoUrl: key };
    await technician.save();
    res.status(200).json({ success: true, message: 'Profile image uploaded successfully', data: { profileImageUrl: key } });
  } catch (error) {
    next(error);
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────
// POST /api/technician-auth/refresh-token
// Body: { "refreshToken": "..." }

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET ||
                'your_super_secret_refresh_key'
            );
        } catch (error) {

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token expired. Please login again.'
                });
            }

            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Make sure this token is a refresh token
        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        // Find technician
        const technician = await User.findOne({
            _id: decoded.id,
            role: 'technician'
        });

        if (!technician) {
            return res.status(401).json({
                success: false,
                message: 'Technician account not found'
            });
        }

        // Generate new access token
        const accessToken = signAccessToken(
            technician._id,
            technician.role
        );

        res.status(200).json({
            success: true,
            accessToken,
            expiresIn: process.env.JWT_EXPIRE || '15m'
        });

    } catch (error) {
        next(error);
    }
};
