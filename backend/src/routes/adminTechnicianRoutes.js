const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const adminTechnicianController = require('../controllers/adminTechnicianController');
const chargesController         = require('../controllers/chargesController');

router.use(protect);

// Explicit admin identity check: public signup cannot opt into the OTP exemption.
const adminOnly = (req, res, next) => {
  if (req.user.constructor.modelName !== 'Admin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only administrators can manage technicians.' });
  }
  if (req.user.isActive === false) return res.status(403).json({ success: false, message: 'Your account is inactive.' });
  next();
};
const { uploadAdminTechnicianDocuments } = require('../middleware/upload');
router.get('/technicians', adminOnly, checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicians);
router.post('/technicians', adminOnly, checkPermission('technician_jobs', 'write'), uploadAdminTechnicianDocuments, adminTechnicianController.createTechnician);
router.post('/technicians/invite', adminOnly, checkPermission('technician_jobs', 'write'), adminTechnicianController.inviteTechnician);
router.patch('/technicians/:technicianId', adminOnly, checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnician);
router.patch('/technicians/:technicianId/account', adminOnly, checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianAccount);

const templateController = require('../controllers/technicianJobTemplateController');
router.get('/technician-job-templates/:templateId', adminOnly, checkPermission('technician_jobs', 'read'), templateController.getTemplate);
router.put('/technician-job-templates/:templateId', adminOnly, checkPermission('technician_jobs', 'write'), templateController.updateTemplate);
router.delete('/technician-job-templates/:templateId', adminOnly, checkPermission('technician_jobs', 'write'), templateController.deleteTemplate);
router.get('/technician-job-templates', adminOnly, checkPermission('technician_jobs', 'read'), templateController.getTemplates);
router.post('/technician-job-templates', adminOnly, checkPermission('technician_jobs', 'write'), templateController.createTemplate);

router.post('/technician-jobs/:jobId/invitations', adminOnly, checkPermission('technician_jobs', 'write'), require('../controllers/jobInvitationController').sendInvitation);

router.get('/technician-jobs', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianJobs);
router.post('/technician-jobs', checkPermission('technician_jobs', 'write'), adminTechnicianController.createTechnicianJob);
router.put('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJob);
router.delete('/technician-jobs/:jobId', checkPermission('technician_jobs', 'write'), adminTechnicianController.deleteTechnicianJob);
router.patch('/technician-jobs/:jobId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianJobStatus);
router.post('/technician-jobs/:jobId/pay', checkPermission('technician_jobs', 'write'), adminTechnicianController.payTechnician);
router.patch('/technician-jobs/:jobId/reschedule', checkPermission('technician_jobs', 'write'), adminTechnicianController.rescheduleJob);
router.get('/technician-requests', checkPermission('technician_jobs', 'read'), adminTechnicianController.getTechnicianRequests);
router.patch('/technician-requests/:requestId/status', checkPermission('technician_jobs', 'write'), adminTechnicianController.updateTechnicianRequest);
router.patch('/technician-requests/:requestId/message', checkPermission('technician_jobs', 'write'), adminTechnicianController.sendTechnicianRequestMessage);

// ── Conversation timeline (charges + messages as one stream) ─────────────────
// Returns full typed conversation for a request — admin view
router.get('/technician-requests/:requestId/conversation', checkPermission('technician_jobs', 'read'), adminTechnicianController.getRequestConversation);

// ── Additional Charges & Invoice (admin side) ─────────────────────────────────
// Get all charges submitted by technician for a request
router.get('/technician-requests/:requestId/charges',        checkPermission('technician_jobs', 'read'),  chargesController.getJobCharges);
// Review a single charge: accept / reject / counter
router.patch('/charges/:chargeId/review',                    checkPermission('technician_jobs', 'write'), chargesController.reviewCharge);
// Generate the final invoice once all charges are resolved
router.post('/technician-requests/:requestId/invoice',       checkPermission('technician_jobs', 'write'), chargesController.generateInvoice);
// Get the invoice for a request
router.get('/technician-requests/:requestId/invoice',        checkPermission('technician_jobs', 'read'),  chargesController.getInvoice);

module.exports = router;
