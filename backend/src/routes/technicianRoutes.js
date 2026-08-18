const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');
const chargesController    = require('../controllers/chargesController');

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

// ── Additional Charges flow (technician side) ─────────────────────────────────
// Submit one or more additional charges for admin review
router.post('/requests/:requestId/charges',   protect, restrictTo('technician'), chargesController.submitCharges);
// Get all charges for a request (with admin review status on each)
router.get('/requests/:requestId/charges',    protect, restrictTo('technician'), chargesController.getMyCharges);
// Full request status — charges + invoice + next action hint
router.get('/requests/:requestId/status',     protect, restrictTo('technician'), chargesController.getMyRequestStatus);
// Accept or reject an admin counter-offer on a single charge
router.patch('/charges/:chargeId/respond',    protect, restrictTo('technician'), chargesController.respondToCounter);
// View the final invoice once generated
router.get('/requests/:requestId/invoice',    protect, restrictTo('technician'), chargesController.getTechnicianInvoice);

module.exports = router;
