const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const adminTechnicianController = require('../controllers/adminTechnicianController');
const chargesController         = require('../controllers/chargesController');

router.use(protect);

router.get('/technician-jobs', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianJobs);
router.post('/technician-jobs', checkPermission('technician_jobs', 'write'), adminTechnicianController.createTechnicianJob);
router.put('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJob);
router.delete('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.deleteTechnicianJob);
router.patch('/technician-jobs/:jobId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJobStatus);
router.post('/technician-jobs/:jobId/pay-wallet', checkPermission('technician_jobs', 'write'), adminTechnicianController.payTechnicianWallet);
router.patch('/technician-jobs/:jobId/reschedule', checkPermission('technician_jobs', 'write'), adminTechnicianController.rescheduleJob);
router.get('/technician-requests', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianRequests);
router.patch('/technician-requests/:requestId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianRequest);
router.patch('/technician-requests/:requestId/message', checkPermission('technician_jobs', 'write'), adminTechnicianController.sendTechnicianRequestMessage);

// ── Additional Charges & Invoice (admin side) ─────────────────────────────────
// Get all charges submitted by technician for a request
router.get('/technician-requests/:requestId/charges',        checkPermission('technician_jobs', 'read'),  chargesController.getJobCharges);
// Review a single charge: accept / reject / counter
router.patch('/charges/:chargeId/review',                    checkPermission('technician_jobs', 'write'), chargesController.reviewCharge);
// Generate the final invoice once all charges are resolved
router.post('/technician-requests/:requestId/invoice',       checkPermission('technician_jobs', 'write'), chargesController.generateInvoice);
// Get the invoice for a request
router.get('/technician-requests/:requestId/invoice',        checkPermission('technician_jobs', 'read'),  chargesController.getInvoice);
// Mark invoice paid → credits technician wallet
router.patch('/technician-requests/:requestId/invoice/pay',  checkPermission('technician_jobs', 'write'), chargesController.markInvoicePaid);

module.exports = router;
