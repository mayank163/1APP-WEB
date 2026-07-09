const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRegister, validateVerifyRegister, validateLogin } = require('../middleware/validation');

// Public routes
router.post('/start-register', validateRegister, authController.startRegister);
router.post('/verify-register', validateVerifyRegister, authController.verifyRegister);
router.post('/register', validateRegister, authController.startRegister);
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateMe);
router.post('/send-otp', protect, authController.sendVerificationOTP);
router.post('/verify-otp', protect, authController.verifyVerificationOTP);

module.exports = router;
