const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const adminTechVerificationController = require('../controllers/adminTechVerificationController');

router.use(protect);

router.get('/technician-verifications', checkPermission('technician_verification', 'read'), adminTechVerificationController.getTechnicianVerificationRequests);
router.patch('/technician-verifications/:technicianId/status', checkPermission('technician_verification', 'write'), adminTechVerificationController.updateTechnicianVerificationStatus);
router.patch('/technician-verifications/:technicianId/documents/:documentId', checkPermission('technician_verification', 'write'), adminTechVerificationController.updateDocumentStatus);

module.exports = router;
