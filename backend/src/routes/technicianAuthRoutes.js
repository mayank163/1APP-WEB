const express = require('express');
const router = express.Router();
const technicianAuthController = require('../controllers/technicianAuthController');
const { protect } = require('../middleware/auth');
const { uploadTechnicianDocuments } = require('../middleware/upload');

router.post('/register', technicianAuthController.startTechnicianSignup);
router.post('/verify-otp', technicianAuthController.verifyTechnicianOTP);
router.post('/complete-profile', protect, technicianAuthController.completeTechnicianProfile);
router.post('/upload-documents', protect, uploadTechnicianDocuments, technicianAuthController.uploadTechnicianDocuments);
router.post('/submit-for-verification', protect, technicianAuthController.submitForVerification);
router.get('/me', protect, technicianAuthController.getTechnicianProfile);
router.put('/bank-details', protect, technicianAuthController.updateBankDetails);

module.exports = router;
