const crypto = require('crypto');
const User = require('../models/User');
const { sendTechnicianOnboardingEmail } = require('../utils/emailService');
const otpService = require('../utils/otpService');
const { normalizePhone, phoneQuery } = require('../utils/phone');
const { sendTechnicianTokenResponse } = require('./technicianAuthController');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

exports.preregister = async (req, res, next) => {
  try {
    const name = text(req.body.name, 120);
    const phone = normalizePhone(req.body.phone);
    const email = text(req.body.email, 254).toLowerCase();
    const address = text(req.body.address, 500);
    const serviceRadius = Number(req.body.serviceRadius);
    const yearsOfExperience = Number(req.body.yearsOfExperience);
    if (!name || !address) throw fail('Name and address are required.');
    if (!Number.isFinite(serviceRadius) || serviceRadius < 1 || serviceRadius > 500) throw fail('Service radius must be between 1 and 500 km.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Enter a valid email address.');
    if (req.body.yearsOfExperience === '' || req.body.yearsOfExperience == null || !Number.isFinite(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 80) throw fail('Experience must be between 0 and 80 years.');
    const skills = [...new Set(text(req.body.skills, 1000).split(',').map(s => s.trim()).filter(Boolean))].slice(0, 30);
    const alternatives = [phoneQuery(phone), ...(email ? [{ email }] : [])];
    if (await User.findOne({ $or: alternatives })) throw fail('This phone number or email is already registered. Use your existing account when the app launches.', 409);
    const generatedPassword = crypto.randomBytes(12).toString('hex');
    await User.create({
      name, phone, email, address, serviceRadius, skills,
      password: generatedPassword,
      role: 'technician', accountStatus: 'invited', profileCompleted: false,
      technicianProfile: { skills, yearsOfExperience, professionalBio: text(req.body.professionalBio, 2000), verificationStatus: 'pending', submittedAt: new Date(),
        documents: [] },
    });
    let emailSent = false;
    try {
      const delivery = await sendTechnicianOnboardingEmail(email, generatedPassword);
      emailSent = Boolean(delivery?.success && !delivery.dev);
      if (!delivery?.success || delivery.dev) console.error('Technician onboarding confirmation email was not delivered.');
    } catch {
      console.error('Technician onboarding confirmation email delivery failed.');
    }
    res.status(201).json({ success: true, emailSent, message: emailSent ? 'Your details are saved. Your generated password has been sent to your email. Verify your registered phone number or email with an OTP to activate your account.' : 'Your details are saved, but we could not email your password. You can still activate your account and sign in using an OTP.' });
  } catch (error) {
    next(error.code === 11000 ? fail('This phone number or email is already registered.', 409) : error);
  }
};

const identity = body => {
  const type = body.type || (body.email && !body.phone ? 'email' : 'phone');
  if (!['phone', 'email'].includes(type)) throw fail('Choose phone or email verification.');
  const value = type === 'email' ? text(body.email, 254).toLowerCase() : normalizePhone(body.phone);
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw fail('Enter a valid email address.');
  return { type, value, query: type === 'email' ? { email: value } : phoneQuery(value) };
};
const eligible = user => user && user.role === 'technician' && ['invited', 'active'].includes(user.accountStatus);

exports.sendLoginOTP = async (req, res, next) => {
  try {
    const { type, value, query } = identity(req.body);
    const user = await User.findOne(query);
    if (eligible(user)) {
      if (type === 'email') await otpService.sendEmailOTP(value, 'technician-otp-login');
      else await otpService.sendOTP(value, 'technician-otp-login');
    }
    res.json({ success: true, message: 'If an eligible technician account exists, a verification code has been sent. It expires in 5 minutes.' });
  } catch (error) { next(error); }
};

exports.verifyLoginOTP = async (req, res, next) => {
  try {
    const { type, value, query } = identity(req.body);
    const user = await User.findOne(query);
    const valid = type === 'email'
      ? otpService.verifyEmailOTP(value, req.body.otp, 'technician-otp-login')
      : otpService.verifyOTP(value, req.body.otp, 'technician-otp-login');
    if (!valid || !eligible(user)) throw fail('Invalid or expired OTP, or account unavailable.', 401);
    if (type === 'email') user.isEmailVerified = true;
    else user.isPhoneVerified = true;
    user.accountStatus = 'active';
    const fcmToken = text(req.body.fcmToken, 4097);
    if (fcmToken && fcmToken.length <= 4096) user.fcmTokens = [...new Set([...(user.fcmTokens || []), fcmToken])];
    await user.save();
    await sendTechnicianTokenResponse(user, 200, res);
  } catch (error) { next(error); }
};
