const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminTechnicianController = require('../controllers/adminTechnicianController');

router.use(protect);
router.use(restrictTo('admin'));

// ── Job CRUD ──────────────────────────────────────────────────────────────────
router.get('/technician-jobs', adminTechnicianController.getTechnicianJobs);
router.post('/technician-jobs', adminTechnicianController.createTechnicianJob);
router.put('/technician-jobs/:jobId', adminTechnicianController.updateTechnicianJob);
router.delete('/technician-jobs/:jobId', adminTechnicianController.deleteTechnicianJob);

// ── Job status + wallet payment ───────────────────────────────────────────────
router.patch('/technician-jobs/:jobId/status', adminTechnicianController.updateTechnicianJobStatus);
router.post('/technician-jobs/:jobId/pay-wallet', adminTechnicianController.payTechnicianWallet);

// ── Requests ──────────────────────────────────────────────────────────────────
router.get('/technician-requests', adminTechnicianController.getTechnicianRequests);
router.patch('/technician-requests/:requestId/status', adminTechnicianController.updateTechnicianRequest);
router.patch('/technician-requests/:requestId/message', adminTechnicianController.sendTechnicianRequestMessage);

module.exports = router;
