const crypto = require('crypto');
const User = require('../models/User');
const {
  normalizePhone,
  phoneQuery
} = require('../utils/phone');
const {
  sendSMS
} = require('../utils/otpService');
const {
  sendEmail
} = require('../utils/emailService');
const {
  uploadFile,
  deleteFile
} = require('../utils/s3Upload');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode
});
const technicianId = user => user.technicianId || `TK-${String(user._id).slice(-12).toUpperCase()}`;
const serializeTechnician = user => ({
  _id: user._id,
  technicianId: technicianId(user),
  name: user.name,
  email: user.email || '',
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  primaryService: user.primaryService || user.skills?.[0] || '',
  skills: user.skills || [],
  serviceArea: user.serviceArea || user.address || '',
  serviceRadius: user.serviceRadius || 15,
  yearsOfExperience: user.technicianProfile?.yearsOfExperience || 0,
  verificationStatus: user.technicianProfile?.verificationStatus || 'not-started',
  documents: user.technicianProfile?.documents || [],
  photoUrl: user.technicianProfile?.photoUrl || user.profileImage?.url || '',
  isOnline: user.isOnline || false,
  totalJobsDone: user.totalJobsDone || 0,
  // Ratings and performance have no source in the current schema.
  rating: null,
  ratingCount: null,
  performance: null,
  accountStatus: user.accountStatus || 'active',
  isPhoneVerified: user.isPhoneVerified,
  createdAt: user.createdAt
});
const parseDetails = body => {
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const email = String(body.email || '').trim().toLowerCase();
  const primaryService = String(body.primaryService || '').trim();
  if (!name || name.length > 120) throw fail('Full name is required (maximum 120 characters).');
  if (!primaryService || primaryService.length > 120) throw fail('Select a primary service / trade.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Enter a valid email address.');
  const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : undefined;
  if (dateOfBirth && (isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date())) throw fail('Enter a valid date of birth.');
  const yearsOfExperience = Number(body.yearsOfExperience || 0);
  const serviceRadius = Number(body.serviceRadius || 15);
  if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 80) throw fail('Experience must be between 0 and 80 years.');
  if (!Number.isFinite(serviceRadius) || serviceRadius < 1 || serviceRadius > 500) throw fail('Service radius must be between 1 and 500 km.');
  const skills = Array.isArray(body.skills) ? body.skills : String(body.skills || '').split(',');
  return {
    name,
    phone,
    email: email || undefined,
    primaryService,
    dateOfBirth,
    serviceRadius,
    serviceArea: String(body.serviceArea || '').trim().slice(0, 200),
    skills: [...new Set(skills.map(s => String(s).trim()).filter(Boolean))].slice(0, 30),
    yearsOfExperience
  };
};
const checkDuplicate = async (details, excludeId) => {
  const alternatives = [phoneQuery(details.phone)];
  if (details.email) alternatives.push({
    email: details.email
  });
  if (await User.findOne({
    $or: alternatives,
    ...(excludeId && {
      _id: {
        $ne: excludeId
      }
    })
  })) {
    throw fail('This mobile number or email is already registered.', 409);
  }
};
const activationURL = (phone = '') => {
  const base = process.env.TECHNICIAN_ACTIVATION_URL;
  if (!base) throw fail('TECHNICIAN_ACTIVATION_URL is not configured.', 503);
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw fail('Invalid activation URL configuration.', 503);
  if (phone) url.searchParams.set('phone', phone);
  return url.toString();
};
const deliverInvitation = async ({
  phone,
  email,
  sms,
  mail
}) => {
  const url = activationURL(phone);
  const deliveries = [];
  if (sms) deliveries.push({
    channel: 'sms',
    target: phone,
    send: () => sendSMS(phone, `You are invited to join 1APP as a technician. Verify your mobile number and set your password: ${url}`)
  });
  if (mail) deliveries.push({
    channel: 'email',
    target: email,
    send: () => sendEmail({
      to: email,
      subject: 'Your 1APP technician invitation',
      text: `You are invited to join 1APP. Verify your mobile number and set your password: ${url}`,
      html: `<p>You are invited to join 1APP as a technician.</p><p><a href="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Activate your account</a></p><p>Verify your mobile number and set your password to get started.</p>`
    })
  });
  return Promise.all(deliveries.map(async ({
    channel,
    target,
    send
  }) => {
    try {
      const result = await send();
      if (result?.dev) throw new Error('Email delivery is not configured.');
      return {
        channel,
        target,
        status: 'sent'
      };
    } catch {
      return {
        channel,
        target,
        status: 'failed'
      };
    }
  }));
};
exports.getTechnicians = async (req, res, next) => {
  try {
    const technicians = await User.find({
      role: 'technician'
    }).select('name email phone dateOfBirth primaryService skills serviceArea serviceRadius address technicianProfile.yearsOfExperience technicianProfile.verificationStatus technicianProfile.documents technicianProfile.photoUrl profileImage.url isOnline totalJobsDone accountStatus isPhoneVerified createdAt technicianId').sort('-createdAt');
    res.json({
      success: true,
      data: {
        technicians: technicians.map(serializeTechnician)
      }
    });
  } catch (error) {
    next(error);
  }
};
exports.createTechnician = async (req, res, next) => {
  const uploaded = [];
  let saved = false;
  try {
    const details = parseDetails(req.body);
    await checkDuplicate(details);
    const sms = req.body.sendSms === 'true' || req.body.sendSms === true;
    const mail = req.body.sendEmail === 'true' || req.body.sendEmail === true;
    if (mail && !details.email) throw fail('Email address is required for email invitations.');
    if (sms || mail) activationURL(details.phone);
    const {
      yearsOfExperience,
      ...fields
    } = details;
    const user = new User({
      ...fields,
      role: 'technician',
      password: crypto.randomBytes(32).toString('hex'),
      technicianId: `TK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      createdByAdmin: req.user._id,
      accountStatus: 'invited',
      isPhoneVerified: false,
      technicianProfile: {
        yearsOfExperience,
        skills: fields.skills,
        verificationStatus: 'not-started'
      }
    });
    await user.validate();
    const docs = {
      profilePhoto: ['Profile Photo', 'photoUrl'],
      drivingLicenseFront: ['ID Proof', 'drivingLicense.front'],
      residentialProof: ['Address Proof', 'residentialProof'],
      cvResume: ['Other Document', 'cvResume']
    };
    for (const [field, [label, target]] of Object.entries(docs)) {
      if (!req.files?.[field]?.[0]) continue;
      const {
        key
      } = await uploadFile(req.files[field][0], `technician-docs/${field}`);
      uploaded.push(key);
      user.set(`technicianProfile.${target}`, key);
      user.technicianProfile.documents.push({
        documentId: field,
        label,
        s3Key: key,
        status: 'pending'
      });
    }
    if (uploaded.length) user.technicianProfile.verificationStatus = 'pending';
    await user.save();
    saved = true;
    const delivery = sms || mail ? await deliverInvitation({
      ...details,
      sms,
      mail
    }) : [];
    res.status(201).json({
      success: true,
      message: 'Technician created without OTP verification.',
      data: {
        technician: serializeTechnician(user),
        delivery
      }
    });
  } catch (error) {
    if (!saved) await Promise.allSettled(uploaded.map(deleteFile));
    if (error.code === 11000) return next(fail('This mobile number or email is already registered.', 409));
    next(error);
  }
};
exports.updateTechnician = async (req, res, next) => {
  try {
    const user = await User.findOne({
      _id: req.params.technicianId,
      role: 'technician'
    });
    if (!user) throw fail('Technician not found.', 404);
    const details = parseDetails(req.body);
    await checkDuplicate(details, user._id);
    if (normalizePhone(user.phone) !== details.phone) user.isPhoneVerified = false;
    if (user.email !== details.email) user.isEmailVerified = false;
    const {
      yearsOfExperience,
      ...fields
    } = details;
    Object.assign(user, fields);
    user.technicianProfile.yearsOfExperience = yearsOfExperience;
    user.technicianProfile.skills = fields.skills;
    await user.save();
    res.json({
      success: true,
      data: {
        technician: serializeTechnician(user)
      }
    });
  } catch (error) {
    next(error.code === 11000 ? fail('This mobile number or email is already registered.', 409) : error);
  }
};
exports.updateTechnicianAccount = async (req, res, next) => {
  try {
    if (!['suspended', 'active'].includes(req.body.status)) throw fail('Invalid account status.');
    const user = await User.findOne({
      _id: req.params.technicianId,
      role: 'technician'
    });
    if (!user) throw fail('Technician not found.', 404);
    user.accountStatus = req.body.status === 'active' && user.createdByAdmin && !user.isPhoneVerified ? 'invited' : req.body.status;
    user.isOnline = false;
    await user.save();
    res.json({
      success: true,
      data: {
        technician: serializeTechnician(user)
      }
    });
  } catch (error) {
    next(error);
  }
};
exports.inviteTechnician = async (req, res, next) => {
  try {
    if (!String(req.body.name || '').trim()) throw fail('Full name is required.');
    const sms = req.body.channel === 'phone';
    if (!sms && req.body.channel !== 'email') throw fail('Choose email or phone.');
    const phone = sms ? normalizePhone(req.body.phone) : '';
    const email = sms ? '' : String(req.body.email || '').trim().toLowerCase();
    if (!sms && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Enter a valid email address.');
    const delivery = await deliverInvitation({
      phone,
      email,
      sms,
      mail: !sms
    });
    if (delivery.some(d => d.status === 'failed')) throw fail('Invitation could not be delivered. Check SMS / email configuration and try again.', 502);
    res.json({
      success: true,
      data: {
        delivery
      }
    });
  } catch (error) {
    next(error);
  }
};
exports.serializeTechnician = serializeTechnician;
