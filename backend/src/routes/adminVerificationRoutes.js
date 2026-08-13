const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminTechVerificationController = require('../controllers/adminTechVerificationController');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/technician-verifications', adminTechVerificationController.getTechnicianVerificationRequests);
router.patch('/technician-verifications/:technicianId/status', adminTechVerificationController.updateTechnicianVerificationStatus);
router.patch('/technician-verifications/:technicianId/documents/:documentId', adminTechVerificationController.updateDocumentStatus);

module.exports = router;
