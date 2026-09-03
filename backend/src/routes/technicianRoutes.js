const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const technicianController = require('../controllers/technicianController');
const chargesController    = require('../controllers/chargesController');

//get jobs with or without filters
router.get('/jobs', protect, restrictTo('technician', 'admin'), technicianController.getJobsForTechnicians);
// Request for the Job
router.post('/jobs/:jobId/request', protect, restrictTo('technician'), technicianController.requestJob);
// Cancel Job Request
router.patch('/job-requests/:requestId/cancel',protect, restrictTo('technician') ,technicianController.cancelJobRequest);
// Get all Requests
router.get('/requests', protect, restrictTo('technician'), technicianController.getMyRequests);
// Get details for dashboard
router.get('/dashboard', protect, restrictTo('technician'), technicianController.getTechnicianDashboard);
// Get all the details for Mobile Home Page Hero Section
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
// admin update the status of charges
router.patch('/requests/:requestId/status', protect, restrictTo('admin'), technicianController.updateRequestStatus);
// send message on request
router.post('/requests/:requestId/message', protect, restrictTo('technician'), technicianController.sendMessageOnRequest);
// get messages on request
router.get('/requests/:requestId/messages', protect, restrictTo('technician'), technicianController.getRequestMessages);

// ── Job progress: technician marks reached & completed ────────────────────────
router.patch('/jobs/:jobId/reached', protect, restrictTo('technician'), technicianController.markReached);
router.patch('/jobs/:jobId/complete', protect, restrictTo('technician'), technicianController.markJobCompleted);


router.get('/conversation/:requestId', protect, restrictTo('technician'), technicianController.getConversationByRequestId);
router.get('/details/:jobId', protect, restrictTo('technician'), technicianController.getDetailsByJobId);
router.post('/withdraw', protect, restrictTo('technician'), technicianController.createWithdrawalRequest);
router.get('/withdrawals', protect, restrictTo('technician'), technicianController.getWithdrawals);
// router.post('/requests/:requestId/counter-offer',protect,restrictTo('technician'),technicianController.counterOffer);
// router.get('/myjobs', protect, restrictTo('technician'), technicianController.getMyJobs);

module.exports = router;
