const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');
const chargesController    = require('../controllers/chargesController');

// ── Jobs ──────────────────────────────────────────────────────────────────────
router.get('/jobs',                   protect, restrictTo('technician', 'admin'), technicianController.getJobsForTechnicians);
router.post('/jobs/:jobId/request',   protect, restrictTo('technician'),          technicianController.requestJob);
router.patch('/job-requests/:requestId/cancel', protect, restrictTo('technician'), technicianController.cancelJobRequest);

// ── Requests ──────────────────────────────────────────────────────────────────
router.get('/requests',                protect, restrictTo('technician'), technicianController.getMyRequests);

// ── Conversation (typed timeline — charges + messages) ────────────────────────
// Primary endpoint: returns the full typed conversation for a request
router.get('/requests/:requestId/conversation', protect, restrictTo('technician', 'admin'), technicianController.getRequestConversation);
// Legacy message-only endpoints (still work)
router.post('/requests/:requestId/message',  protect, restrictTo('technician'), technicianController.sendMessageOnRequest);
router.get('/requests/:requestId/messages',  protect, restrictTo('technician'), technicianController.getRequestMessages);

// ── Additional Charges flow ───────────────────────────────────────────────────
router.post('/requests/:requestId/charges',  protect, restrictTo('technician'), chargesController.submitCharges);
router.get('/requests/:requestId/charges',   protect, restrictTo('technician'), chargesController.getMyCharges);
router.get('/requests/:requestId/status',    protect, restrictTo('technician'), chargesController.getMyRequestStatus);
router.patch('/charges/:chargeId/respond',   protect, restrictTo('technician'), chargesController.respondToCounter);
router.get('/requests/:requestId/invoice',   protect, restrictTo('technician'), chargesController.getTechnicianInvoice);

// ── Admin status update on request ───────────────────────────────────────────
router.patch('/requests/:requestId/status',  protect, restrictTo('admin'),      technicianController.updateRequestStatus);

// ── Dashboard / metrics ───────────────────────────────────────────────────────
router.get('/dashboard', protect, restrictTo('technician'), technicianController.getTechnicianDashboard);
router.get('/metrics',   protect, restrictTo('technician'), technicianController.getMetrics);

// ── Job progress ──────────────────────────────────────────────────────────────
router.patch('/jobs/:jobId/reached',  protect, restrictTo('technician'), technicianController.markReached);
router.patch('/jobs/:jobId/complete', protect, restrictTo('technician'), technicianController.markJobCompleted);
router.patch('/jobs/:jobId/tasks/:taskIndex/complete', protect, restrictTo('technician'), technicianController.completeTask);

// ── Detail pages ─────────────────────────────────────────────────────────────
router.get('/details/:jobId', protect, restrictTo('technician'), technicianController.getDetailsByJobId);

// ── Wallet ────────────────────────────────────────────────────────────────────
router.post('/withdraw',    protect, restrictTo('technician'), technicianController.createWithdrawalRequest);
router.get('/withdrawals',  protect, restrictTo('technician'), technicianController.getWithdrawals);

module.exports = router;
