const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');

router.get('/jobs', protect, restrictTo('technician', 'admin'), technicianController.getJobsForTechnicians);
router.post('/jobs/:jobId/request', protect, restrictTo('technician'), technicianController.requestJob);
router.post('/requests/:requestId/counter-offer',protect,restrictTo('technician'),technicianController.counterOffer);

// ── Job progress: technician marks reached & completed ────────────────────────
router.patch('/jobs/:jobId/reached', protect, restrictTo('technician'), technicianController.markReached);
router.patch('/jobs/:jobId/complete', protect, restrictTo('technician'), technicianController.markJobCompleted);

router.get('/requests', protect, restrictTo('technician'), technicianController.getMyRequests);
router.get('/dashboard', protect, restrictTo('technician'), technicianController.getTechnicianDashboard);
router.post('/withdraw', protect, restrictTo('technician'), technicianController.createWithdrawalRequest);
router.get('/withdrawals', protect, restrictTo('technician'), technicianController.getWithdrawals);
router.patch('/requests/:requestId/status', protect, restrictTo('admin'), technicianController.updateRequestStatus);
router.post('/requests/:requestId/message', protect, restrictTo('technician'), technicianController.sendMessageOnRequest);
router.get('/requests/:requestId/messages', protect, restrictTo('technician'), technicianController.getRequestMessages);
router.get('/metrics', protect, restrictTo('technician'), technicianController.getMetrics);

module.exports = router;
