const express = require('express');
const router = express.Router();
const technicianAuthController = require('../controllers/technicianAuthController');
const { protect } = require('../middleware/auth');
const { uploadTechnicianDocuments, uploadProfileImage, uploadCompleteProfile, uploadBankDetails, uploadSingleDocument } = require('../middleware/upload');

const rateLimit = require('express-rate-limit');
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Too many attempts. Please try again later.' } });
router.use(['/send-otp', '/verify-otp', '/complete-signup', '/activation/send-otp', '/activation/complete'], otpLimiter);
router.post('/activation/send-otp', technicianAuthController.sendActivationOTP);
router.post('/activation/complete', technicianAuthController.activateTechnician);

// ── New 3-step signup ─────────────────────────────────────────────────────────
router.post('/send-otp',        technicianAuthController.sendOTP);
router.post('/verify-otp',      technicianAuthController.verifyOTP);
router.post('/complete-signup', technicianAuthController.completeSignup);
router.post('/login',           technicianAuthController.login);
router.post('/refresh-token',   technicianAuthController.refreshToken);

// ── Post-signup profile steps ─────────────────────────────────────────────────
router.post('/complete-profile',       protect, uploadCompleteProfile, technicianAuthController.completeTechnicianProfile);
router.post('/upload-documents',       protect, uploadTechnicianDocuments, technicianAuthController.uploadTechnicianDocuments);
router.post('/upload-profile-image',   protect, uploadProfileImage, technicianAuthController.uploadProfileImageHandler);
router.post('/submit-for-verification',protect, technicianAuthController.submitForVerification);
router.get('/me',                      protect, technicianAuthController.getTechnicianProfile);
router.put('/bank-details',            protect, uploadBankDetails, technicianAuthController.updateBankDetails);
router.put('/documents/:documentId',   protect, uploadSingleDocument, technicianAuthController.reuploadDocument);

module.exports = router;
